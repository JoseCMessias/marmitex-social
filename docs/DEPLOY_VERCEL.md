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

## Persistência da Planilha Excel na Vercel (Vercel Blob) & Limpeza a cada 10 Minutos

> **Importante:** A Vercel executa funções **Serverless** sem disco local persistente. Sem configurar o **Vercel Blob**, a API usa `/tmp/marmitex_social.xlsx`, que é efêmero por instância e apaga os pratos inseridos ao dar refresh ou ocorrer cold start.
>
> Agora a API suporta **persistência real do arquivo `.xlsx` no Vercel Blob** automaticamente assim que a variável `BLOB_READ_WRITE_TOKEN` está configurada no projeto da API.

### Como ativar o Vercel Blob no projeto da API (`server-d27r`)

1. No painel da Vercel, abra o projeto da API (`server-d27r`).
2. Vá em **Storage → Create Database → Blob**, crie uma store (Public ou Private) e clique em **Connect Project** conectando ao projeto da API.
3. Faça um **Redeploy** (ou dê push no repositório). A partir daí, `/api/health` e o Painel Admin mostrarão `Vercel Blob (.xlsx persistente)` e todos os pratos/pedidos adicionados ficarão salvos na planilha mesmo após atualizar a página.

### Limpeza automática dos pratos inseridos (10 minutos)

- Os 8 pratos originais do catálogo (`MARM-101` a `MARM-108`) permanecem fixos na planilha.
- Todo prato inserido manualmente (`MARM-109+`) permanece na planilha por **10 minutos** (`criadoEm`) e depois é removido automaticamente pela função `cleanupInsertedMarmitas`:
  - **Localmente:** um agendador (`setInterval` a cada 10 minutos) executa a limpeza ativa em segundo plano.
  - **Na Vercel (plano Hobby):** a limpeza ocorre automaticamente a cada requisição após os 10 minutos, e também há o endpoint `GET/POST /api/marmitas/cleanup` (além de `/api/cron/cleanup` e do botão **"Limpar Inseridos Agora"** no painel Admin).

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

O projeto do frontend em `https://client-one-theta-55.vercel.app` já está pré-conectado à API `https://server-d27r.vercel.app` via `client/vercel.json` (proxy de `/api/*` e `/uploads/*`) e fallback em `client/src/services/api.js`.

1. Confirme as configurações do projeto `client` na Vercel:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
2. *(Opcional)* Se mudar o domínio da API no futuro, adicione em **Environment Variables** (ou atualize `client/vercel.json`):
   - **Name:** `VITE_API_URL`
   - **Value:** `https://server-d27r.vercel.app` *(sem `/` no final)*
3. Após enviar as alterações (`git push`), os projetos conectados (`server-d27r` e `client`) publicam automaticamente; depois acesse:
   - Loja: `https://client-one-theta-55.vercel.app/#/`
   - Admin: `https://client-one-theta-55.vercel.app/#/admin`
