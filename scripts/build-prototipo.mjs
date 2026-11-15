import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from '../client/node_modules/esbuild/lib/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_PROTOTIPO = path.join(ROOT_DIR, 'docs', 'prototipo.html');
const PUBLIC_PROTOTIPO = path.join(ROOT_DIR, 'client', 'public', 'prototipo.html');
const ROOT_EXE = path.join(ROOT_DIR, 'MarmitexSocial-Prototipo.exe');
const PUBLIC_EXE = path.join(ROOT_DIR, 'client', 'public', 'MarmitexSocial-Prototipo.exe');
const CS_LAUNCHER = path.join(__dirname, 'PrototipoLauncher.cs');

async function buildQrInlineScript() {
  const result = await esbuild.build({
    stdin: {
      contents: [
        "import QRCode from 'qrcode/lib/core/qrcode.js';",
        "import svgTag from 'qrcode/lib/renderer/svg-tag.js';",
        "window.renderPixQrSvg = (text) => svgTag.render(QRCode.create(String(text || ''), { errorCorrectionLevel: 'M' }), { margin: 2, color: { dark: '#1C1917', light: '#FFFFFF' } });",
      ].join('\n'),
      resolveDir: path.join(ROOT_DIR, 'client'),
      loader: 'js',
    },
    bundle: true,
    minify: true,
    write: false,
    format: 'iife',
  });

  // Escape closing script tags defensively just in case
  return result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}

function createBrandIcoBuffer() {
  const size = 32;
  const pixelBytes = size * size * 4;
  const maskBytes = (size / 8) * size;
  const dibHeaderSize = 40;
  const imageSize = dibHeaderSize + pixelBytes + maskBytes;

  const buf = Buffer.alloc(6 + 16 + imageSize);
  // ICONDIR
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(1, 4);

  // ICONDIRENTRY
  buf[6] = size;
  buf[7] = size;
  buf[8] = 0;
  buf[9] = 0;
  buf.writeUInt16LE(1, 10);
  buf.writeUInt16LE(32, 12);
  buf.writeUInt32LE(imageSize, 14);
  buf.writeUInt32LE(22, 18);

  // BITMAPINFOHEADER (bottom-up height = 2 * size)
  let o = 22;
  buf.writeUInt32LE(dibHeaderSize, o);
  buf.writeInt32LE(size, o + 4);
  buf.writeInt32LE(size * 2, o + 8);
  buf.writeUInt16LE(1, o + 12);
  buf.writeUInt16LE(32, o + 14);
  buf.writeUInt32LE(0, o + 16);
  buf.writeUInt32LE(pixelBytes + maskBytes, o + 20);

  // Letter "M" pixel grid inside rounded orange square
  const mRows = [
    '0000000000000000',
    '0011000000001100',
    '0011100000011100',
    '0011110000111100',
    '0011011001101100',
    '0011001111001100',
    '0011000110001100',
    '0011000000001100',
    '0011000000001100',
    '0011000000001100',
    '0011000000001100',
    '0000000000000000',
  ];

  const pixelOffset = 22 + dibHeaderSize;
  for (let y = 0; y < size; y += 1) {
    // BMP stores rows bottom-up
    const srcY = size - 1 - y;
    for (let x = 0; x < size; x += 1) {
      const idx = pixelOffset + (y * size + x) * 4;
      const dx = Math.max(0, Math.abs(x - 15.5) - 10.5);
      const dy = Math.max(0, Math.abs(srcY - 15.5) - 10.5);
      const insideRounded = dx * dx + dy * dy <= 25;

      if (!insideRounded) {
        buf[idx] = 0;
        buf[idx + 1] = 0;
        buf[idx + 2] = 0;
        buf[idx + 3] = 0;
        continue;
      }

      const gx = x - 8;
      const gy = srcY - 10;
      const isLetter =
        gy >= 0 && gy < mRows.length && gx >= 0 && gx < 16 && mRows[gy][gx] === '1';

      if (isLetter) {
        // White letter "M" (BGRA)
        buf[idx] = 255;
        buf[idx + 1] = 255;
        buf[idx + 2] = 255;
        buf[idx + 3] = 255;
      } else {
        // Orange gradient (#F97316 -> #EA580C) in BGRA
        const t = srcY / (size - 1);
        buf[idx] = Math.round(22 * (1 - t) + 12 * t);
        buf[idx + 1] = Math.round(115 * (1 - t) + 88 * t);
        buf[idx + 2] = Math.round(249 * (1 - t) + 234 * t);
        buf[idx + 3] = 255;
      }
    }
  }

  return buf;
}

async function findCscCompiler() {
  const candidates = [
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // keep looking
    }
  }
  throw new Error('Compilador csc.exe (.NET Framework v4.0) não encontrado no Windows.');
}

async function main() {
  const qrScript = await buildQrInlineScript();
  const rawHtml = await fs.readFile(DOCS_PROTOTIPO, 'utf8');
  const markerRegex = /<!-- QR_BUNDLE_START -->[\s\S]*?<!-- QR_BUNDLE_END -->/;
  if (!markerRegex.test(rawHtml)) {
    throw new Error('Marcadores QR_BUNDLE_START / QR_BUNDLE_END não encontrados em docs/prototipo.html.');
  }

  const updatedHtml = rawHtml.replace(
    markerRegex,
    `<!-- QR_BUNDLE_START -->\n  <script>${qrScript}</script>\n  <!-- QR_BUNDLE_END -->`
  );

  await fs.writeFile(DOCS_PROTOTIPO, updatedHtml, 'utf8');
  await fs.writeFile(PUBLIC_PROTOTIPO, updatedHtml, 'utf8');

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marmitex-exe-'));
  try {
    const tmpHtml = path.join(tmpDir, 'prototipo.html');
    const tmpIco = path.join(tmpDir, 'marmitex.ico');
    await fs.writeFile(tmpHtml, updatedHtml, 'utf8');
    await fs.writeFile(tmpIco, createBrandIcoBuffer());

    const cscPath = await findCscCompiler();
    execFileSync(
      cscPath,
      [
        '/nologo',
        '/optimize+',
        '/platform:anycpu',
        '/target:winexe',
        `/win32icon:${tmpIco}`,
        `/resource:${tmpHtml},prototipo.html`,
        `/out:${ROOT_EXE}`,
        CS_LAUNCHER,
      ],
      { stdio: 'inherit' }
    );

    await fs.copyFile(ROOT_EXE, PUBLIC_EXE);
    const exeStat = await fs.stat(ROOT_EXE);
    console.log(`Built ${ROOT_EXE} (${(exeStat.size / 1024).toFixed(1)} KB)`);
    console.log(`Synced ${PUBLIC_PROTOTIPO}`);
    console.log(`Synced ${PUBLIC_EXE}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
