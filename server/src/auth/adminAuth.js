import crypto from 'node:crypto';

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas

export function getAdminConfig() {
  const username = (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim();
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const parsedTtl = Number(process.env.ADMIN_SESSION_TTL_MS);
  const sessionTtlMs =
    Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : DEFAULT_SESSION_TTL_MS;

  const explicitSecret = process.env.ADMIN_AUTH_SECRET;
  const derivedSeed = `${username}:${password}:${
    process.env.VERCEL_PROJECT_ID || process.env.BLOB_READ_WRITE_TOKEN || 'marmitexsocial-admin-key'
  }`;
  const secret =
    explicitSecret || crypto.createHash('sha256').update(derivedSeed).digest('hex');

  return { username, password, sessionTtlMs, secret };
}

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest();
}

export function constantTimeEqual(a, b) {
  return crypto.timingSafeEqual(sha256Buffer(a), sha256Buffer(b));
}

export function verifyAdminCredentials(inputUsername, inputPassword) {
  const { username, password } = getAdminConfig();
  const normalizedInputUser = String(inputUsername ?? '').trim();
  const rawInputPassword = String(inputPassword ?? '');

  const userMatches = constantTimeEqual(normalizedInputUser, username);
  const passwordMatches = constantTimeEqual(rawInputPassword, password);
  return userMatches && passwordMatches;
}

function signPayload(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

export function createAdminToken(username) {
  const { sessionTtlMs, secret } = getAdminConfig();
  const now = Date.now();
  const payload = {
    sub: String(username),
    role: 'admin',
    iat: now,
    exp: now + sessionTtlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = signPayload(payloadB64, secret);

  return {
    token: `${payloadB64}.${signature}`,
    expiresAt: new Date(payload.exp).toISOString(),
    user: {
      username: payload.sub,
      role: payload.role,
    },
  };
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

  const [payloadB64, providedSig] = parts;
  const { secret } = getAdminConfig();
  const expectedSig = signPayload(payloadB64, secret);

  if (!constantTimeEqual(providedSig, expectedSig)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (
      !parsed ||
      parsed.role !== 'admin' ||
      !parsed.sub ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function extractBearerToken(req) {
  const header = req.headers?.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function requireAdminAuth(req, res, next) {
  const token = extractBearerToken(req);
  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Acesso restrito ao administrador. Faça login para continuar.',
    });
  }

  req.admin = {
    username: payload.sub,
    role: payload.role,
    exp: payload.exp,
  };
  return next();
}
