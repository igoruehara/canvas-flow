# Architecture

**Pattern:** Modular monolith — NestJS modules no backend, SPA monolítica no frontend, pacote npm que empacota ambos.

## High-Level Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                     Usuário / Canais                            │
│   Browser (editor) │ WhatsApp │ Web Widget │ API │ Webhooks     │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │  Frontend (React + React Flow)         │  Dev: Vite :5177
         │  frontend/src/App.tsx + components     │
         └───────────────────┬───────────────────┘
                             │ REST /api/*
         ┌───────────────────┴───────────────────┐
         │  Backend (NestJS)                      │  :3333 ou Lambda
         │  backend/src/                          │
         │  ├─ canvas-flow (CRUD fluxos/agentes)  │
         │  ├─ runner (execução de fluxos)        │
         │  ├─ rag, memory, http-batch            │
         │  ├─ auth, api-key, provider-config     │
         │  └─ queue (SQS), mcp-oauth, documents  │
         └───────┬─────────────┬──────────┬───────┘
                 │             │          │
            MongoDB         Milvus/Zilliz  AWS (SQS, S3)
            (obrigatório)   (RAG)         (opcional)
```

**Modo standalone (npm):** CLI `canvas-flow.js` lê `~/.canvas-flow/config.json`, injeta env vars, faz preflight Mongo, sobe `server/main.js` e serve `public/` same-origin.

## Identified Patterns

### NestJS Feature Module

**Location:** `backend/src/*/` (ex.: `canvas-flow/`, `runner/`, `rag/`)
**Purpose:** Isolar domínio com controller, service, schema Mongoose e providers de conexão.
**Implementation:** Cada módulo exporta `*-module.ts` que importa `DatabaseModule` e registra `connectProviders` para injetar models Mongoose via token `STRING_URL_DATABASE_CONNECTION`.
**Example:** `canvas-flow-module.ts` → `CanvasFlowController`, `CanvasFlowService`, `connectProviders`

### Connect Provider (Mongoose Model Factory)

**Location:** `backend/src/*/*-connect-provider.ts`
**Purpose:** Registrar schemas Mongoose como providers NestJS injetáveis.
**Implementation:** `useFactory` recebe `Connection` e retorna `connection.model(COLLECTION, Schema)`.
**Example:** `canvas-flow-connect-provider.ts` — models `CanvasFlow`, `Agent`, `Version`

### Dual Configuration (dev vs standalone)

**Location:** `backend/.env` (dev), `npm_canvas_flow/bin/canvas-flow.js` + `templates/config.example.json` (standalone)
**Purpose:** Dev usa `.env`; usuário final npm usa `config.json` privado sem versionar secrets.
**Implementation:** CLI mapeia JSON → `process.env` antes de `require(server/main.js)`.

### Flow Execution Engine

**Location:** `backend/src/runner/runner-service.ts`, `langgraph-runtime.service.ts`
**Purpose:** Interpretar nós do canvas (message, input, api, condition, end, group, component) e executar RAG/MCP/httpBatch.
**Implementation:** `RunnerService` orquestra steps; LangGraph persiste checkpoints em Mongo quando habilitado.
**Example:** `POST /api/canvas-flow/test` via `runner-controller.ts`

### Provider Resolution Layer

**Location:** `backend/src/provider-config/provider-config-service.ts`
**Purpose:** Resolver LLM keys/models por escopo (global, agent, env) com criptografia de secrets no Mongo.
**Implementation:** `getEffectiveSettings()` merge agent + global + env; consumido por `RunnerService` e `RagService`.

### Static Frontend from Backend

**Location:** `backend/src/main.ts` — `setupStaticFrontend()`
**Purpose:** Same-origin no pacote npm (API + SPA no mesmo host).
**Implementation:** Se `CANVAS_FLOW_STATIC_DIR` aponta para `public/`, Express serve estáticos e fallback SPA exceto `/api`, `/docs`, `/health`.

## Data Flow

### Editor → Save Flow

1. Frontend (`App.tsx`) edita `FlowConfig` no React Flow state.
2. `canvasApi` (`lib/api.ts`) envia `PUT/PATCH /api/canvas-flows/:id` com token/API key.
3. `CanvasFlowController` valida auth via `AuthService.assertUiAuth()`.
4. `CanvasFlowService` persiste draft + versionamento em Mongo (`canvas_flows`, `canvas_flow_versions`).

### Test Flow (simulação)

1. Frontend painel de teste → `POST /api/canvas-flow/test`.
2. `RunnerController` → `RunnerService.runFlow()` / LangGraph runtime.
3. Steps percorridos: mensagem → input → condição → componente RAG → httpBatch → fim.
4. `MemoryService` grava turnos; trace retornado ao frontend.

### RAG Query

1. Componente `RAG IA Gen` no fluxo aciona `RagService.chatLlmRag()`.
2. Embeddings via OpenAI/Azure; busca vetorial Milvus ou Azure Search.
3. Contexto injetado no prompt LLM; resposta volta ao runner.

### WhatsApp / Webhook (produção AWS)

1. Webhook externo → Lambda handler (`lambda.ts`) ou API HTTP.
2. Se `CANVAS_FLOW_SQS=true`, `SqsTransitionService.enqueue()` persiste job + envia SQS.
3. `RunnerQueueProcessor` consome fila, dedupe/rate-limit via collections Mongo.
4. `RunnerService` executa fluxo do agente canal WhatsApp.

## Code Organization

**Approach:** Feature-based no backend; frontend concentrado em poucos arquivos grandes + componentes modais.

**Backend modules (`app.module.ts`):**
- `CanvasFlowModule`, `RunnerModule`, `RagModule`, `MemoryModule`
- `HttpBatchModule`, `AuthModule`, `ApiKeyModule`, `ProviderConfigModule`
- `McpOAuthModule`, `DocumentsModule`, `FlowTagModule`, `QueueModule`

**Frontend:**
- `App.tsx` — editor principal (~8.8k linhas)
- `components/` — modais (Provider, AgentStudio, WhatsApp, ApiKeys, Inspector)
- `lib/` — API client, defaults, templates, modelos LLM
- `types/flow.ts` — contrato TypeScript do fluxo

**Module boundaries:** Backend modules se comunicam via services exportados; `RunnerModule` é o hub de execução. Frontend depende apenas da API REST, não importa backend.
