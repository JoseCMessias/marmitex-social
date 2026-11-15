# MarmitexSocial

Aplicação web completa para **venda e entrega de marmitas** de diversos pratos e gostos, desenvolvida com **React + Vite**, **Node.js + Express** e **Planilha Excel (`.xlsx`)** como base de dados para todo o controle (**criar, ler, editar e deletar**).

---

## Principais Funcionalidades

- **Visão do Cliente (`#/`)**:
  - Interface clara (`#FFFBF5`) para leitura confortável, destaques em laranja (`#EA580C`) para estimular o apetite e botões de compra em verde esmeralda (`#16A34A`) para conversão direta.
  - Busca por nome, ingrediente ou gosto (`Caseiro`, `Leve`, `Picante`, `Rico em Proteína`, etc.).
  - Filtros por **Categoria** (`Tradicional`, `Fitness & Low Carb`, `Vegetariana & Vegana`, `Executiva`, `Gourmet`, `Massas`), **Gosto** e **Ofertas do Dia**.
  - Modal de detalhes com observações personalizadas por prato, sacola lateral persistente e checkout em 1 passo (sem exigir login).
- **Visão do Administrador (`#/admin`)**:
  - Cadastro de novas marmitas com seleção de categoria, tags de gosto, preço normal/promocional, peso, calorias, tempo de preparo e imagem (URL, upload de arquivo local ou galeria pronta).
  - Edição completa de informações, alternância rápida de disponibilidade (`Disponível` / `Pausada`) e destaque, duplicação de pratos e exclusão com confirmação.
  - Gestão de pedidos recebidos com atualização de status (`Recebido`, `Em Preparo`, `Saiu para Entrega`, `Entregue`, `Cancelado`).
  - Inspetor ao vivo das abas da planilha Excel e botão para baixar o arquivo `.xlsx`.
- **Base de Dados em Planilha Excel (`.xlsx`)**:
  - Arquivo salvo em [`server/data/marmitex_social.xlsx`](server/data/marmitex_social.xlsx) com as abas **`Marmitas`** e **`Pedidos`**.
  - Todas as operações passam por uma fila sequencial (`writeMutex`) e gravação atômica para evitar conflitos e corrupção do arquivo.

---

## Estrutura do Projeto

```text
MarmitexSocial/
├── package.json                        # Scripts unificados (dev, dev:server, dev:client, build, start)
├── README.md                           # Documentação principal
├── docs/
│   ├── PROTOTIPAGEM_E_GUIA_DE_USO.md   # Prototipagem completa + passo a passo de uso
│   └── prototipo.html                  # Protótipo interativo clicável (abre direto no navegador)
├── client/                             # Frontend React + Vite + Tailwind CSS
│   ├── vite.config.js                  # Proxy /api e /uploads -> http://127.0.0.1:3001
│   ├── public/images/marmitas/         # Fotos dos pratos iniciais
│   └── src/
│       ├── App.jsx
│       ├── services/api.js
│       ├── utils/format.js
│       └── components/
│           ├── Header.jsx
│           ├── Toast.jsx
│           ├── customer/               # HeroBanner, FilterBar, MarmitaCard, MarmitaModal, CartDrawer
│           └── admin/                  # AdminDashboard, MarmitaFormModal, OrdersTab, ExcelPreviewTab
└── server/                             # Backend Node.js + Express + ExcelJS
    ├── data/marmitex_social.xlsx       # Planilha Excel (criada e populada automaticamente)
    ├── uploads/                        # Imagens enviadas pelo administrador
    ├── tests/                          # Testes automatizados (CRUD Excel e API HTTP)
    └── src/
        ├── index.js                    # Servidor Express (porta 3001)
        ├── db/excelDb.js               # Camada de acesso/gravação na planilha Excel
        ├── routes/
        │   ├── marmitas.js             # Endpoints CRUD de marmitas + upload
        │   └── pedidos.js              # Endpoints de pedidos e status
        └── seed/initialMarmitas.js     # Cardápio e pedidos iniciais
```

---

## Como Instalar e Executar

### 1. Instalar dependências (primeira vez)
Na raiz `C:\Privado\Projetos\MarmitexSocial`:
```bash
npm run install:all
```

### 2. Rodar API e Frontend juntos (recomendado em desenvolvimento)
```bash
npm run dev
```
- **Frontend (Vite):** `http://localhost:5173/`
  - Visão do Cliente: `http://localhost:5173/#/`
  - Visão do Administrador: `http://localhost:5173/#/admin`
- **API (Node.js):** `http://localhost:3001` (`http://localhost:3001/api/health`)

### 3. Rodar API e Frontend separadamente (2 terminais)
- **Terminal 1 — API Node.js (porta `3001`):**
  ```bash
  npm run dev:server
  ```
  *(Ou `cd server` e `npm run dev` para modo watch restrito a `src/`, ou `npm start` sem watch.)*
- **Terminal 2 — Frontend React + Vite (porta `5173`):**
  ```bash
  npm run dev:client
  ```
  *(Ou `cd client` e `npm run dev`.)*

### 4. Rodar em Modo Produção (servidor único na porta `3001`)
Gera os arquivos estáticos em `client/dist/` e serve tudo pela própria API Express:

```bash
npm run build
npm start
```
Acesse em `http://localhost:3001/#/` (cliente) e `http://localhost:3001/#/admin` (admin).

### 5. Acessar Online na Vercel
- **Aplicação Web (Loja e Admin):** **[Clicla aqui](https://client-one-theta-55.vercel.app/)**
- **Protótipo Interativo de Telas:** **[Visualizar Prototipagem na Vercel](https://marmitex-social-docs.vercel.app/)**

---

## Endpoints da API (`http://localhost:3001`)

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Verifica status da API e caminho da planilha `.xlsx` |
| `GET` | `/api/marmitas` | Lista marmitas (filtros opcionais: `disponivel=true`, `categoria`, `q`) |
| `GET` | `/api/marmitas/:id` | Busca uma marmita pelo ID (`MARM-XXX`) |
| `POST` | `/api/marmitas` | Cadastra nova marmita na aba `Marmitas` |
| `PUT` / `PATCH` | `/api/marmitas/:id` | Edita informações ou flags (`disponivel`, `destaque`) de uma marmita |
| `DELETE` | `/api/marmitas/:id` | Remove uma marmita da planilha |
| `POST` | `/api/marmitas/upload` | Faz upload de imagem (`multipart/form-data`, campo `image`, até 5 MB) |
| `GET` | `/api/pedidos` | Lista todos os pedidos da aba `Pedidos` |
| `POST` | `/api/pedidos` | Registra um novo pedido calculando os preços direto do Excel |
| `PATCH` | `/api/pedidos/:id/status` | Atualiza status (`Recebido`, `Em Preparo`, `Saiu para Entrega`, `Entregue`, `Cancelado`) |
| `GET` | `/api/excel/snapshot` | Retorna metadados e linhas atuais das abas `Marmitas` e `Pedidos` |
| `GET` | `/api/excel/download` | Faz o download do arquivo `marmitex_social.xlsx` |

---

## Testes Automatizados

Executa a suíte de testes de integração da planilha Excel e das rotas HTTP:
```bash
npm --prefix server test
```

Para validar o build do frontend:
```bash
npm run build
```

---

## Prototipagem, Passo a Passo e Deploy

- **Visualizar protótipo interativo na Vercel:** [https://marmitex-social-docs.vercel.app/](https://marmitex-social-docs.vercel.app/)
- **Protótipo interativo clicável local:** abra [`docs/prototipo.html`](docs/prototipo.html) diretamente no navegador.
- **Guia completo e prototipagem em Markdown:** [`docs/PROTOTIPAGEM_E_GUIA_DE_USO.md`](docs/PROTOTIPAGEM_E_GUIA_DE_USO.md)
- **Deploy na Vercel (API, Frontend e Protótipo):** [`docs/DEPLOY_VERCEL.md`](docs/DEPLOY_VERCEL.md)

---

## Solução de Problemas Comuns

- **Arquivo Excel bloqueado no Windows (`EPERM` / `EBUSY`):** se você abrir `server/data/marmitex_social.xlsx` no Microsoft Excel, o Windows bloqueia a gravação pela API enquanto a planilha estiver aberta. Feche o Excel antes de salvar ou excluir registros pelo painel.
- **Erro de conexão com a API ao iniciar (`ECONNREFUSED`):** certifique-se de que a API está rodando na porta `3001` (`npm run dev` ou `npm run dev:server`). O proxy em `client/vite.config.js` aponta para `http://127.0.0.1:3001` e a tela inicial tenta reconectar automaticamente durante a inicialização.
