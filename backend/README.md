# Canvas Flow Backend

Backend NestJS isolado para o Canvas Flow. Ele executa fluxos conversacionais, canais de entrada, RAG, provedores de IA, filas, login multi-organizacao e metricas operacionais.

## Features Suportadas

### Core Do Canvas

| Status | Feature | Observacao |
| --- | --- | --- |
| [x] | CRUD de fluxos conversacionais | `POST/GET/PATCH/DELETE /api/canvas-flows` |
| [x] | Reordenacao de fluxos | `PATCH /api/canvas-flows/reorder` |
| [x] | Teste real de fluxo | `POST /api/canvas-flow/test` |
| [x] | Teste real com stream | `POST /api/canvas-flow/test/stream` |
| [x] | Execucao por Web Widget | Canal `webWidget` |
| [x] | Execucao por WhatsApp | Canal `whatsapp` |
| [x] | Memoria por conversa | `GET/DELETE /api/memory/:conversationId` |
| [x] | Mensagens com delay de loop | Inclui `delayBeforeMs` e execucao assincrona |
| [x] | Tags por no | Salva eventos por conversa, fluxo, agente e organizacao |
| [x] | Dashboard de tags | `POST /api/canvas-flow/tags/dashboard` |
| [x] | Historico de mensagens paginado | Integrado ao dashboard de tags |

### Autenticacao E Organizacoes

| Status | Feature | Flag/env |
| --- | --- | --- |
| [x] | Login opcional | `CANVAS_FLOW_LOGIN=true` |
| [x] | JWT | `CANVAS_FLOW_JWT_SECRET` |
| [x] | Bootstrap inicial | `POST /api/auth/bootstrap` |
| [x] | Criar organizacao | `POST /api/auth/organizations` |
| [x] | Usuario em mais de uma organizacao | Login usa email + organizacao |
| [x] | Troca de organizacao | Via auth/session no frontend |
| [x] | Cadastro de usuarios na organizacao | `POST /api/auth/users` |
| [x] | Token master/API key | `CANVAS_FLOW_API_TOKEN` |
| [x] | Chaves de API por escopo | `api/canvas-flow-api-keys` |

### Componentes Executados Pelo Backend

| Status | Componente | Suporte |
| --- | --- | --- |
| [x] | Mensagem | Texto fixo ou gerado por LLM |
| [x] | Mensagem rica | Texto, botoes, respostas rapidas, lista, carrossel e flow de agendamento |
| [x] | Input | Coleta de dados e validacao |
| [x] | API | Chamadas HTTP manuais ou geradas por LLM |
| [x] | Condicao | JS ou LLM |
| [x] | Encapsulador/grupo | Organizacao visual, sem alterar execucao |
| [x] | Fim | Finalizacao e resposta |
| [x] | OpenAI Gen | Chat, embedding e OCR via OpenAI |
| [x] | Azure OpenAI | Chat, embedding e OCR por deployment Azure |
| [x] | Milvus | Indexacao, busca, listagem, leitura e exclusao |
| [x] | Azure AI Search | Busca RAG e indexacao vetorial/hibrida |
| [x] | Azure Blob Storage | Upload/list/read/index de chunks/documentos |
| [x] | Documentos/Files | Upload preservando original, leitura estruturada, geração e edição versionada |
| [x] | S3 privado | Binários originais e artefatos com URLs temporárias de download |
| [x] | MongoDB | CRUD, count e aggregate |
| [x] | Contexto | JSON dinamico, JS ou LLM retornando JSON |
| [x] | Dashboard | Summary, table, funnel, timeseries, bar e pie |
| [x] | Loop | Iteracoes, condicao JS de parada e delay por volta |
| [x] | Roteador de fluxo | Jump por regra JS ou LLM |
| [x] | CRON | Intervalo, diario, semanal e mensal |
| [x] | Debug | Snapshot do contexto |

### RAG E Dados

| Status | Feature | Observacao |
| --- | --- | --- |
| [x] | RAG com Milvus/Zilliz | Vetorizacao e busca |
| [x] | RAG com Azure AI Search | Busca vetorial/hibrida |
| [x] | Chunks em Azure Blob Storage | Armazenamento de documentos/chunks |
| [x] | Busca em Blob Storage | List/read com filtros |
| [x] | Embeddings OpenAI | Provider direto |
| [x] | Embeddings Azure OpenAI | Provider Azure |
| [x] | Busca hibrida | Dense/sparse, pesos e RRF/weighted score |
| [x] | CRUD de documentos RAG | List/get/update/delete |
| [x] | Upload de arquivos para RAG | PDF, DOCX, TXT/MD/JSON/CSV, XLSX |
| [x] | Bloqueio de `.xls` legado | Evita parser inseguro |
| [x] | MongoDB operacional | Componente MongoDB separado da base principal |

### Provedores Configuraveis

| Status | Provedor | Onde configurar |
| --- | --- | --- |
| [x] | OpenAI | Tela Provedores ou env fallback |
| [x] | Azure OpenAI | Tela Provedores ou env fallback |
| [x] | Milvus | Tela Provedores ou env fallback |
| [x] | Azure Blob Storage | Tela Provedores ou env fallback |
| [x] | Azure AI Search | Tela Provedores ou env fallback |
| [x] | MongoDB operacional | Tela Provedores ou env fallback |
| [x] | Segredos mascarados | Secrets nao retornam em claro depois de salvos |

### WhatsApp

| Status | Feature | Observacao |
| --- | --- | --- |
| [x] | API Oficial Meta | Webhook GET/POST e envio direto |
| [x] | Blip | Recebimento por webhook e payload de resposta |
| [x] | Sinch | Envio direto ou relay/API response |
| [x] | Botoes/listas | Renderizacao por provedor quando suportado |
| [x] | WhatsApp Flows | Criar, subir JSON e publicar flow |
| [x] | Flow de agendamento | Dados dinamicos por contexto e LLM |
| [x] | Webhook por fluxo | `/api/canvas-flow/webhook/whatsapp/:flowId` |
| [x] | Webhook por fluxo principal do agente | `/api/canvas-flow/webhook/whatsapp-main/:agentId` |

### Assincrono, Lambda E Enterprise

| Status | Feature | Flag/env |
| --- | --- | --- |
| [x] | Lambda via Serverless | `serverless.yaml` |
| [x] | Lambda Function URL | HTTP publico sem API Gateway |
| [x] | Configuracao via AWS SSM | `CANVAS_FLOW_SSM_PREFIX` |
| [x] | SQS Standard | Criado pelo stack Serverless |
| [x] | DLQ SQS | Criada pelo stack Serverless |
| [x] | Worker/consumer no proprio Lambda | Trigger SQS ou endpoint manual |
| [x] | Lock por conversationId | Evita corrida por conversa em fila Standard |
| [x] | Job status/retry | `GET/POST /api/canvas-flow/sqs/jobs/:jobId` |
| [x] | Health da fila | `GET /api/canvas-flow/sqs/health` |
| [x] | Rate limit por canal | WebWidget, WhatsApp e API |
| [x] | Dedupe de mensagens | TTL configuravel |
| [x] | CRON interno | `CANVAS_FLOW_CRON_AUTORUN` |

### Seguranca

| Status | Feature | Observacao |
| --- | --- | --- |
| [x] | `helmet` | Headers HTTP seguros |
| [x] | `x-powered-by` removido | Reduz fingerprinting |
| [x] | CORS por allowlist | `CORS_ORIGINS` |
| [x] | Limite de body | `REQUEST_BODY_LIMIT` |
| [x] | Swagger protegido por ambiente | `ENABLE_SWAGGER=false` em producao |
| [x] | Audit npm limpo | `npm audit` com 0 vulnerabilidades conhecidas |
| [x] | Logs sanitizados | Evita vazar secrets em observabilidade |
| [x] | Secrets de provedores mascarados | Provider config nao devolve token bruto |

## Variaveis De Ambiente

Use `.env.example` como base.

Minimo local:

```env
PORT=3333
NODE_ENV=development
MONGO_DB_CONNECTION_STRING=mongodb://127.0.0.1:27017/canvas_flow
CORS_ORIGINS=http://localhost:5177
REQUEST_BODY_LIMIT=2mb
ENABLE_SWAGGER=true
```

Minimo recomendado em producao:

```env
NODE_ENV=production
MONGO_DB_CONNECTION_STRING=<mongodb-uri>
CORS_ORIGINS=https://seu-frontend.com
REQUEST_BODY_LIMIT=2mb
ENABLE_SWAGGER=false
CANVAS_FLOW_API_TOKEN=<token-forte>
CANVAS_FLOW_JWT_SECRET=<jwt-secret-forte>
CANVAS_FLOW_FILES_STORAGE=s3
CANVAS_FLOW_FILES_S3_BUCKET=<bucket-privado>
```

### Documentos E Artefatos

O componente `Files` salva o binário original e mantém uma referência no Mongo. Em desenvolvimento, use `CANVAS_FLOW_FILES_STORAGE=local`; em AWS/Lambda, o stack Serverless cria um bucket S3 privado com versionamento.

Operações disponíveis:

- `read`: extrai texto e estrutura para o agente.
- `generate`: cria TXT, Markdown, CSV, JSON, HTML, DOCX, XLSX ou PDF.
- `edit`: preenche placeholders como `{{cliente.nome}}` ou aplica alteracoes estruturais em tabelas de um ou mais DOCX, criando uma nova versão de cada template sem sobrescrever os originais. A saída completa fica em `context.slots.<responseName>.artifacts`; `artifact` continua apontando para o primeiro arquivo por compatibilidade.

Endpoints de documentos:

- `POST /api/documents/list`
- `POST /api/documents/generate`
- `GET /api/documents/:documentId/download`
- `GET /api/documents/:documentId/download-url`

## Endpoints Principais

### Health

- `GET /health`

### Fluxos

- `POST /api/canvas-flows`
- `GET /api/canvas-flows?agentId=...`
- `GET /api/canvas-flows/:id`
- `PATCH /api/canvas-flows/reorder`
- `PATCH /api/canvas-flows/:id`
- `DELETE /api/canvas-flows/:id`

### Execucao

- `POST /api/canvas-flow/test`
- `POST /api/canvas-flow/test/stream`
- `POST /api/canvas-flow/cron/run-due`
- `GET /api/canvas-flow/reports/:fileName`

### WhatsApp

- `GET /api/canvas-flow/webhook/whatsapp/:flowId`
- `POST /api/canvas-flow/webhook/whatsapp/:flowId`
- `GET /api/canvas-flow/webhook/whatsapp-main/:agentId`
- `POST /api/canvas-flow/webhook/whatsapp-main/:agentId`
- `POST /api/canvas-flow/whatsapp-flows`
- `POST /api/canvas-flow/whatsapp-flows/:flowId/assets`
- `POST /api/canvas-flow/whatsapp-flows/:flowId/publish`

### RAG

- `POST /api/rag/create-collection`
- `POST /api/rag/create-index`
- `POST /api/rag/add-documents`
- `POST /api/rag/add-documents-from-file`
- `POST /api/rag/documents/list`
- `POST /api/rag/documents/get`
- `POST /api/rag/documents/update`
- `POST /api/rag/documents/delete`
- `POST /api/rag/embedding-create`
- `POST /api/rag/search-hybrid`
- `POST /api/rag/chat-llm-rag`
- `GET /api/rag/collections`

### Admin E Configuracoes

- `GET /api/auth/config`
- `POST /api/auth/bootstrap`
- `POST /api/auth/organizations`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/users`
- `GET /api/provider-config`
- `PATCH /api/provider-config`
- `DELETE /api/provider-config/:section`
- `GET /api/canvas-flow-api-keys`
- `POST /api/canvas-flow-api-keys`
- `DELETE /api/canvas-flow-api-keys/:id`

### SQS

- `POST /api/canvas-flow/sqs/consume`
- `GET /api/canvas-flow/sqs/jobs/:jobId`
- `POST /api/canvas-flow/sqs/jobs/:jobId/retry`
- `GET /api/canvas-flow/sqs/health`

## Rode Local

```bash
npm install
cp .env.example .env
npm run start:dev
```

## Validacao

```bash
npm run build
npm test -- --runInBand
npm run audit:prod
npm audit
```

Para producao, use `.env.production.example` como baseline de hardening e rode
tambem o gate documentado em `../docs/PRODUCTION_READINESS.md`.

## Lambda AWS

Este backend esta configurado para Lambda container image via Serverless usando **Lambda Function URL** para HTTP.

O deploy nao cria API Gateway para as rotas HTTP. Isso evita colocar o fluxo atras do timeout do API Gateway. A propria Lambda continua com `timeout: 900` segundos no `serverless.yaml`.

Depois do deploy, o output `CanvasFlowLambdaFunctionUrl` mostra a URL publica:

```text
https://<id>.lambda-url.<region>.on.aws
```

Use essa URL em:

- `CANVAS_FLOW_PUBLIC_URL`, para callbacks e links gerados pelo backend;
- `VITE_CANVAS_FLOW_API_URL`, no frontend;
- webhooks do WhatsApp, Blip ou Sinch.

O mesmo deploy tambem cria:

- `CanvasFlowQueue`: fila SQS Standard principal;
- `CanvasFlowDeadLetterQueue`: DLQ;
- event source mapping SQS -> Lambda, controlado por `CANVAS_FLOW_SQS_TRIGGER_ENABLED`;
- outputs `CanvasFlowSqsQueueUrl`, `CanvasFlowSqsQueueArn`, `CanvasFlowSqsDeadLetterQueueUrl` e `CanvasFlowSqsDeadLetterQueueArn`.

Para a aplicacao realmente publicar mensagens na fila, deixe:

```env
CANVAS_FLOW_SQS=true
CANVAS_FLOW_SQS_TRIGGER_ENABLED=true
```

No deploy Lambda, `CANVAS_FLOW_SQS_QUEUE_URL` e `CANVAS_FLOW_SQS_QUEUE_ARN` sao injetados automaticamente a partir da fila criada pelo stack. Voce so precisa preencher esses valores manualmente se for rodar local ou usar uma fila externa.

Principais arquivos:

- `serverless.yaml`
- `Dockerfile`
- `src/lambda.ts`
- `ymls/custom.yml`
- `ymls/environment.yml`

Deploy:

```bash
npm run deploy -- --stage dev --config serverless.yaml
```

Exemplo de SSM para producao:

```text
/canvas-flow/prd/CANVAS_FLOW_PUBLIC_URL = https://<id>.lambda-url.us-east-1.on.aws
/canvas-flow/prd/CORS_ORIGINS = https://seu-frontend.com
```

O pipeline GitHub Actions fica em `../.github/workflows/aws.yml`.
