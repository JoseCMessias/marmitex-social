# Guia de Deploy na Vercel — MarmitexSocial

Este guia explica por que ocorria o erro `500 FUNCTION_INVOCATION_FAILED`, o que foi ajustado no projeto e o passo a passo para publicar a **API (`server/`)** e o **Frontend (`client/`)** na Vercel.

---

## Por que ocorria `500 FUNCTION_INVOCATION_FAILED`?

1. **Falta do entrypoint Serverless (`api/index.js`) e `vercel.json` na pasta `server/`**: a API exportava `createApp` em `src/index.js`, mas não havia um handler padrão para as Serverless Functions da Vercel.
2. **Sistema de arquivos somente leitura na Vercel (`/var/task`)**: a Vercel bloqueia escrita em pastas locais como `server/data/` e `server/uploads/` (`EROFS: read-only file system`), permitindo gravação apenas em `/tmp`.
3. **Dependência local acidental em `server/package.json`**: existia `"marmitex-social": "file:.."` apontando para fora da pasta `server/`, o que quebra o `npm install` quando `Root Directory` está configurado como `server`.

Todos os três pontos já foram corrigidos:
- Criados `server/api/index.js` e `server/vercel.json`.
- `server/src/db/excelDb.js` e `server/src/routes/marmitas.js` agora usam automaticamente `os.tmpdir()` (`/tmp`) quando `process.env.VERCEL` está definido.
- Removida a referência inválida `"file:.."` de `server/package.json` e `client/package.json`.
- Adicionada rota `GET /` na API e suporte a `VITE_API_URL` em `client/src/services/api.js`.

---

## Aviso Importante Sobre Planilha Excel na Vercel

> **Atenção:** A Vercel executa funções **Serverless** sem disco persistente. O diretório `/tmp` usado em `process.env.VERCEL` permite que a API funcione sem erro `500`, porém **os dados gravados em `/tmp/marmitex_social.xlsx` são temporários** e voltam ao cardápio inicial sempre que a função hiberna (cold start) ou escala entre instâncias.
>
> Para **persistência permanente** da planilha `.xlsx` em produção, recomenda-se hospedar apenas a pasta `server/` em uma plataforma Node com disco persistente (ex.: **Render**, **Railway**, **Fly.io** ou VPS) ou migrar o armazenamento da planilha para **Vercel Blob / S3 / Banco de Dados**. O frontend (`client/`) pode ficar na Vercel normalmente.

---

## Passo a Passo: Deploy da API (`server/`) na Vercel

### Opção A — Pelo Painel Web da Vercel (GitHub)

1. Faça `commit` e `push` das alterações deste repositório para o GitHub:
   ```bash
   git add .
   git commit -m "Configura deploy serverless da API na Vercel"
   git push
   ```
2. Acesse [vercel.com](https://vercel.com) → **Add New... → Project** e selecione seu repositório `MarmitexSocial`.
3. Na configuração do projeto da API:
   - **Framework Preset:** `Other`
   - **Root Directory:** clique em **Edit** e selecione `server`
   - **Build Command:** deixe vazio (ou `echo "API ready"`)
   - **Output Directory:** deixe vazio
4. Clique em **Deploy**.
5. Ao concluir, teste no navegador:
   - `https://<seu-dominio-api>.vercel.app/`
   - `https://<seu-dominio-api>.vercel.app/api/health`
   - `https://<seu-dominio-api>.vercel.app/api/marmitas`

### Opção B — Pela CLI da Vercel (`vercel`)

1. Instale a CLI (se necessário) e faça login:
   ```bash
   npm i -g vercel
   vercel login
   ```
2. Entre na pasta `server` e publique:
   ```bash
   cd C:\Privado\Projetos\MarmitexSocial\server
   vercel --prod
   ```
3. Responda às perguntas mantendo o diretório atual (`server`) como raiz e sem sobrescrever comandos de build.

---

## Passo a Passo: Deploy do Frontend (`client/`) na Vercel

O projeto do frontend em `https://client-one-theta-55.vercel.app` já está pré-conectado à API `https://server-peach-six-28.vercel.app` via `client/vercel.json` (proxy de `/api/*` e `/uploads/*`).

1. Confirme as configurações do projeto `client` na Vercel:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
2. *(Opcional)* Se mudar o domínio da API no futuro, adicione em **Environment Variables** (ou atualize `client/vercel.json`):
   - **Name:** `VITE_API_URL`
   - **Value:** `https://server-peach-six-28.vercel.app` *(sem `/` no final)*
3. Após enviar as alterações (`git push`), faça **Redeploy** nos dois projetos (`server-peach-six-28` e `client-one-theta-55`) e acesse:
   - Loja: `https://client-one-theta-55.vercel.app/#/`
   - Admin: `https://client-one-theta-55.vercel.app/#/admin`
