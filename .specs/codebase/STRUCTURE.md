# Project Structure

**Root:** `e:\dev\canvas_flow`

## Directory Tree

```
canvas_flow/
├── frontend/                 # React SPA (fonte do editor)
│   └── src/
│       ├── App.tsx           # Editor principal
│       ├── components/       # Modais e nós do canvas
│       ├── lib/              # API, defaults, templates
│       └── types/            # Tipos do fluxo
├── backend/                  # NestJS API (fonte da verdade)
│   └── src/
│       ├── app.module.ts
│       ├── main.ts           # Bootstrap local
│       ├── lambda.ts         # Handler AWS Lambda
│       ├── canvas-flow/      # CRUD fluxos e agentes
│       ├── runner/           # Execução de fluxos + LangGraph
│       ├── rag/              # RAG, embeddings, Milvus
│       ├── memory/           # Histórico por conversa
│       ├── auth/             # Login, orgs, JWT
│       ├── provider-config/  # LLM providers e secrets
│       ├── queue/            # SQS jobs, locks, dedupe
│       ├── http-batch/       # Tool HTTP para IA
│       ├── mcp-oauth/        # MCP externo + OAuth
│       ├── documents/        # DOCX/XLSX/PDF artifacts
│       ├── api-key/          # API keys por org
│       ├── flow-tag/         # Tags de execução
│       ├── database/         # Conexão Mongo
│       ├── llm/              # OpenAI client factory
│       ├── observability/    # Logging estruturado
│       └── scripts/          # Migrations one-off
├── npm_canvas_flow/          # Pacote publicado no npm
│   ├── bin/canvas-flow.js    # CLI standalone
│   ├── scripts/build-package.mjs
│   ├── templates/            # config.example.json, docker-compose
│   ├── public/               # frontend/dist (gerado)
│   └── server/               # backend/dist (gerado)
├── website/                  # Site estático GitHub Pages
├── docker-compose.yml        # Infra local dev
├── .github/workflows/        # CI deploy AWS
└── .specs/                   # Spec-driven docs (TLC)
    └── codebase/             # Brownfield mapping
```

## Module Organization

### Frontend (`frontend/`)

**Purpose:** Editor visual de fluxos, teste inline, configuração de providers/canais.
**Key files:** `App.tsx`, `lib/api.ts`, `types/flow.ts`, `components/ProviderConfigModal.tsx`

### Backend (`backend/`)

**Purpose:** API REST, execução de agentes, persistência, integrações externas.
**Key files:** `app.module.ts`, `runner/runner-service.ts`, `rag/rag-service.ts`

### NPM Package (`npm_canvas_flow/`)

**Purpose:** Distribuição standalone via `npx @igoruehara/canvas-flow`.
**Key files:** `bin/canvas-flow.js`, `scripts/build-package.mjs`, `templates/config.example.json`
**Nota:** `public/` e `server/` são artefatos gerados — não editar manualmente.

### Website (`website/`)

**Purpose:** Marketing e documentação pública (GitHub Pages).
**Key files:** `index.html`, `docs.html`, `assets/site.js`

## Where Things Live

**Flow CRUD:**
- UI: `frontend/src/App.tsx`
- API: `backend/src/canvas-flow/canvas-flow-controller.ts`
- Logic: `backend/src/canvas-flow/canvas-flow-service.ts`
- Data: `backend/src/canvas-flow/canvas-flow-schema.ts`

**Flow execution:**
- UI test panel: `frontend/src/App.tsx`
- API: `backend/src/runner/runner-controller.ts`
- Logic: `backend/src/runner/runner-service.ts`, `langgraph-runtime.service.ts`
- Queue (async): `backend/src/queue/`, `runner-queue-processor.ts`

**RAG:**
- UI component config: `frontend/src/components/Inspector.tsx`
- API: `backend/src/rag/rag-controller.ts`
- Logic: `backend/src/rag/rag-service.ts`

**Provider / LLM config:**
- UI: `frontend/src/components/ProviderConfigModal.tsx`
- API: `backend/src/provider-config/provider-config-controller.ts`
- Logic: `backend/src/provider-config/provider-config-service.ts`

**Authentication:**
- UI gate: `frontend/src/components/AuthGate.tsx`
- API: `backend/src/auth/auth-controller.ts`
- Logic: `backend/src/auth/auth-service.ts`

**Standalone config:**
- CLI: `npm_canvas_flow/bin/canvas-flow.js`
- Template: `npm_canvas_flow/templates/config.example.json`
- Runtime path: `~/.canvas-flow/config.json`

**Dev config:**
- Backend: `backend/.env` (from `.env.example`)
- Frontend: `frontend/.env` (Vite vars `VITE_*`)

## Special Directories

**`npm_canvas_flow/public` e `npm_canvas_flow/server`:**
Artefatos de build copiados por `npm run bundle`. Regenerar sempre que frontend/backend mudarem.

**`backend/src/scripts/`:**
Migrations manuais executadas via npm scripts (`migrate:flow-versions`, `migrate:mcp-oauth-user-scope`).

**`.specs/codebase/`:**
Documentação brownfield gerada pelo TLC Spec-Driven — base para planejamento de features.
