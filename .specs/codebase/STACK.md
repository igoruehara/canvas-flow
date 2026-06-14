# Tech Stack

**Analyzed:** 2026-06-13

## Core

- **Monorepo layout:** `frontend/`, `backend/`, `npm_canvas_flow/`, `website/`
- **Language:** TypeScript 5.7 (frontend + backend)
- **Runtime:** Node.js >= 20
- **Package manager:** npm (cada pasta tem seu próprio `package.json`)

## Frontend

- **UI Framework:** React 18.3
- **Build tool:** Vite 6.0
- **Canvas/editor:** React Flow 11.11
- **Icons:** lucide-react 0.468
- **Styling:** CSS global (`frontend/src/styles.css`), sem Tailwind/CSS-in-JS
- **State management:** React hooks locais (`useState`, `useMemo`, `useCallback`) — sem Redux/Zustand
- **HTTP client:** `fetch` nativo via `frontend/src/lib/api.ts`
- **Module system:** ESM (`"type": "module"`)

## Backend

- **Framework:** NestJS 11.1
- **API style:** REST HTTP (Express adapter)
- **ORM/ODM:** Mongoose 8.8 sobre MongoDB
- **Validation:** class-validator + class-transformer (DTOs)
- **API docs:** @nestjs/swagger + swagger-ui-express (`/docs`)
- **Security:** helmet, CORS configurável, production guard (`production-guard.ts`)
- **Runtime de fluxos:** LangGraph 1.3 + checkpoint MongoDB
- **LLM SDK:** openai 4.89, integrações via `llm/openai-provider.ts` e `ProviderConfigService`
- **Auth:** JWT HMAC custom + scrypt para senhas (`auth-service.ts`); API token + x-api-key

## Testing

- **Unit/Integration (backend):** Jest 29.7 + ts-jest + @nestjs/testing
- **E2E:** não configurado
- **Frontend tests:** nenhum framework instalado
- **Lint (backend):** ESLint 9 + Prettier + @typescript-eslint

## External Services

- **Database:** MongoDB 7 (obrigatório em runtime)
- **Vector DB:** Milvus/Zilliz (`@zilliz/milvus2-sdk-node` 2.6.11) — opcional para RAG
- **LLM/Embeddings:** OpenAI, Azure OpenAI, Gemini, Claude, Grok, Bedrock (via provider config)
- **Object storage:** AWS S3, Azure Blob (documentos/RAG)
- **Queue:** AWS SQS (transições assíncronas de fluxo, opcional)
- **Deploy:** AWS Lambda via Serverless Framework 3.38 + Docker image ECR
- **MCP:** @modelcontextprotocol/sdk (OAuth + ferramentas externas)
- **WhatsApp:** Meta Embedded Signup (presets Sinergy no CLI npm)

## Development Tools

- **Local infra:** Docker Compose (`docker-compose.yml`) — mongo, etcd, minio, milvus
- **CI/CD:** GitHub Actions (`.github/workflows/aws.yml`) — test, audit, build, deploy Lambda
- **Bundling npm:** `npm_canvas_flow/scripts/build-package.mjs` — build frontend + backend, copia `dist/`
- **CLI standalone:** `npm_canvas_flow/bin/canvas-flow.js` — init, doctor, infra, config
- **Migrations:** ts-node scripts em `backend/src/scripts/`

## Build Outputs

| App | Source build | Destino npm |
|-----|-------------|-------------|
| Frontend | `frontend/dist` | `npm_canvas_flow/public` |
| Backend | `backend/dist` | `npm_canvas_flow/server` |
