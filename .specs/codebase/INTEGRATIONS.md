# External Integrations

## MongoDB

**Service:** MongoDB 7
**Purpose:** Persistência obrigatória — fluxos, agentes, versões, auth, memória, provider config, queue metadata, LangGraph checkpoints.
**Implementation:** `backend/src/database/database.providers.ts` — conexão via Mongoose no bootstrap NestJS.
**Configuration:**
- Dev: `MONGO_DB_CONNECTION_STRING` em `backend/.env`
- Standalone: `database.mongoUrl` em `~/.canvas-flow/config.json`
- Default fallback: `mongodb://127.0.0.1:27017/canvas_flow`
**Authentication:** Connection string URI (user/pass embutidos).

## Milvus / Zilliz

**Service:** Milvus 2.x (local Docker ou Zilliz Cloud)
**Purpose:** Vector store para RAG — embeddings OpenAI indexados por agente.
**Implementation:** `backend/src/rag/rag-service.ts` — `@zilliz/milvus2-sdk-node`
**Configuration:**
- `MILVUS_ADDRESS`, `MILVUS_TOKEN`, `COLLECTION_NAME`
- Standalone: seção `milvus` em config.json
**Authentication:** Token Zilliz quando cloud; local sem token.
**Note:** Opcional — app sobe sem Milvus; RAG degradado ou indisponível.

## OpenAI / Azure OpenAI / Multi-LLM

**Service:** OpenAI API, Azure OpenAI, Google Gemini, Anthropic Claude, xAI Grok, AWS Bedrock
**Purpose:** Chat, embeddings, OCR para RAG e execução de nós LLM no runner.
**Implementation:**
- `backend/src/llm/openai-provider.ts` — factory OpenAI client
- `backend/src/provider-config/provider-config-service.ts` — resolução multi-provider
**Configuration:** `providers.*` em config.json ou env vars (`OPENAI_API_KEY`, `AZURE_OPENAI_*`, etc.)
**Authentication:** API keys criptografadas no Mongo (provider-config) ou env.

## AWS SQS

**Service:** Amazon SQS
**Purpose:** Fila assíncrona para transições de fluxo (webhooks WhatsApp, carga alta).
**Implementation:** `backend/src/queue/sqs-transition-service.ts`, `runner-queue-processor.ts`
**Configuration:**
- `CANVAS_FLOW_SQS=true`, `CANVAS_FLOW_SQS_QUEUE_URL`, `AWS_REGION`
- Job TTL, dedupe, rate-limit via collections Mongo auxiliares
**Authentication:** AWS credential provider chain (IAM role em Lambda, keys local).

## AWS S3

**Service:** Amazon S3
**Purpose:** Armazenamento de documentos/artifacts gerados (`CANVAS_FLOW_FILES_STORAGE=s3`).
**Implementation:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` em `documents-service.ts`
**Configuration:** `CANVAS_FLOW_FILES_S3_BUCKET`, `CANVAS_FLOW_FILES_S3_REGION`
**Authentication:** AWS credentials via default provider.

## Azure Blob Storage

**Service:** Azure Storage Blob
**Purpose:** Ingestão RAG de documentos Azure; container client em RagService.
**Implementation:** `@azure/storage-blob` em `rag-service.ts`
**Configuration:** Provider settings Azure section em provider-config.

## Model Context Protocol (MCP)

**Service:** MCP servers externos
**Purpose:** Ferramentas externas invocáveis durante execução de fluxo; OAuth para servidores protegidos.
**Implementation:**
- `backend/src/mcp-oauth/` — OAuth flow, token storage
- `backend/src/runner/runner-service.ts` — MCP client transports (SSE, HTTP, WebSocket)
**Configuration:** Por agente via flow config + `McpOAuthService`
**Authentication:** OAuth2 ou headers configuráveis por conexão MCP.

## Meta WhatsApp Business

**Service:** Meta Embedded Signup / Cloud API
**Purpose:** Canal WhatsApp para agentes — onboarding e webhooks.
**Implementation:**
- Preset Sinergy em `npm_canvas_flow/bin/canvas-flow.js` (`SINERGY_WHATSAPP_COEXISTENCE_PRESET`)
- Flow config WhatsApp em frontend `WhatsAppConfigModal.tsx`
- Webhook handling via runner + SQS path
**Configuration:** App ID, Config ID, WABA ID, Phone Number ID, access tokens via UI/config.
**Authentication:** Meta OAuth embedded signup ou tokens manuais.

## Web Widget

**Service:** Embeddable chat widget (first-party)
**Purpose:** Canal web para agentes.
**Implementation:** `frontend/src/components/WebWidgetPreviewModal.tsx`, config em `defaultFlow.ts` (`createWebWidgetConfig`)
**Configuration:** Por agente no flow config; served via runner endpoints.

## HTTP Batch (outbound APIs)

**Service:** APIs HTTP arbitrárias
**Purpose:** Tool para IA chamar APIs externas durante RAG ou steps `api`.
**Implementation:** `backend/src/http-batch/http-batch-service.ts`
**Configuration:** Definida por nó no fluxo (URLs, headers, body templates).
**Authentication:** Por request no step config.

## AWS Lambda + Serverless

**Service:** AWS Lambda (container image)
**Purpose:** Deploy produção do backend com auto-scale.
**Implementation:** `backend/src/lambda.ts`, `backend/serverless.yaml`, `backend/Dockerfile`
**Configuration:** GitHub secrets por stage (dev/hml/prd); env injetado no deploy.
**Authentication:** IAM via GitHub Actions OIDC/keys.

## Docker (local infra)

**Service:** Docker Compose
**Purpose:** Mongo, Milvus stack local para dev e `canvas-flow infra up`.
**Implementation:** `docker-compose.yml` (repo root), `npm_canvas_flow/templates/docker-compose.yml`
**Configuration:** CLI flags `--with-docker`, `--full`

## API Integrations (internal REST)

### Canvas Flow API

**Purpose:** CRUD e execução — consumida pelo frontend e integradores externos.
**Location:** Controllers em `backend/src/*/`
**Authentication:** Bearer JWT, `x-canvas-flow-token`, `x-api-key`
**Key endpoints:**

| Prefix | Controller | Purpose |
|--------|-----------|---------|
| `/api/canvas-flows` | canvas-flow-controller | CRUD fluxos/agentes/versões |
| `/api/canvas-flow` | runner-controller | test, run, webhooks, runtime |
| `/api/rag` | rag-controller | ingest, search, chat RAG |
| `/api/memory` | memory-controller | histórico conversas |
| `/api/auth` | auth-controller | login, register, session |
| `/api/provider-config` | provider-config-controller | LLM settings |
| `/api/mcp-oauth` | mcp-oauth-controller | MCP OAuth flow |
| `/api/documents` | documents-controller | DOCX/XLSX/PDF |
| `/api/http-batch` | http-batch-controller | execução HTTP tool |
| `/api/canvas-flow-api-keys` | api-key-controller | API keys |
| `/health` | health-controller | health check |

## Background Jobs

**Queue system:** AWS SQS (opcional) + Mongo job/lock/dedupe collections
**Location:** `backend/src/queue/`, `backend/src/runner/runner-queue-processor.ts`
**Jobs:** Enqueue flow transitions from webhooks; processor invokes `RunnerService`
**Cron:** `cronAutorun` / `cronScanMs` em config — scan periódico de jobs pendentes

## LangGraph Checkpoints

**Service:** MongoDB collections (via `@langchain/langgraph-checkpoint-mongodb`)
**Purpose:** Estado durável de execução LangGraph entre invocações.
**Implementation:** `backend/src/runner/langgraph-runtime.service.ts`
**Configuration:** `langGraphCheckpointCollection`, `langGraphWritesCollection`, TTL hours
