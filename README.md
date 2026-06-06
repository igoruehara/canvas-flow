# Canvas Flow

Canvas Flow é um workspace para criar, testar e executar agentes de IA em fluxos visuais, com canais prontos para atendimento e automação via WhatsApp e Web Widget.

Pastas:
- `frontend`: editor visual React Flow desacoplado do frontend atual.
- `backend`: API NestJS no estilo dos projetos `rag_v2` e `orquestrador`.

Escopo implementado:
- Criação de agentes de IA para WhatsApp, Web Widget, API e webhooks.
- Canvas com nós: mensagem, input, API/httpBatch, condição, fim e encapsulador.
- Componentes reduzidos: `RAG IA Gen` e `Debug`.
- Backend com CRUD de fluxos.
- RAG com OpenAI embeddings + Milvus/Zilliz.
- Memória por turnos em Mongo por `agentId + conversationId`.
- Tool `httpBatch` para a IA chamar APIs durante o RAG.
- Teste real do fluxo via `POST /api/canvas-flow/test`.

## Interface

### Editor Visual

![Editor visual de fluxos do Canvas Flow](npm_canvas_flow/docs/screenshots/flow-editor.png)

### Teste do Fluxo

![Editor visual com painel de teste do fluxo](npm_canvas_flow/docs/screenshots/flow-editor-test-panel.png)

### Biblioteca de Componentes

![Biblioteca de componentes do Canvas Flow](npm_canvas_flow/docs/screenshots/component-library.png)

### Provedores

![Tela de provedores do Canvas Flow](npm_canvas_flow/docs/screenshots/providers.png)

## Rodar local

Suba a infraestrutura local se ainda não tiver Mongo/Milvus:

```bash
docker compose up -d mongo etcd minio milvus
```

Backend:

```bash
cd backend
copy .env.example .env
npm install
npm run start:dev
```

Frontend:

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

URLs padrão:
- Frontend: `http://localhost:5177`
- Backend: `http://localhost:3333`
- Swagger: `http://localhost:3333/docs`

## Deploy AWS Lambda

O backend usa Serverless Framework com imagem Docker publicada em ECR.

Arquivos:
- `backend/serverless.yaml`
- `backend/Dockerfile`
- `backend/ymls/custom.yml`
- `backend/ymls/environment.yml`
- `.github/workflows/aws.yml`

Branches do pipeline:
- `main` ou `prd`: stage `prd`
- `homolog` ou `hml`: stage `hml`
- `dev`: stage `dev`

Secrets esperados no GitHub:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `SERVERLESS_ACCESS_KEY`
- `CANVAS_FLOW_MONGO_DB_CONNECTION_STRING` ou os específicos `*_DEV`, `*_HML`, `*_PRD`
- `CANVAS_FLOW_MILVUS_ADDRESS` ou os específicos por stage
- `CANVAS_FLOW_MILVUS_TOKEN` se usar Zilliz token
- `CANVAS_FLOW_OPENAI_API_KEY` ou os específicos por stage
- opcional: `CANVAS_FLOW_COLLECTION_NAME`

Deploy manual:

```bash
cd backend
npm run build
npm run deploy -- --stage dev --config serverless.yaml
```

Teste local da resolução do Serverless:

```bash
cd backend
npx serverless@3.38.0 print --stage dev --config serverless.yaml
```

## Observação

O backend compila sem depender de Mongo/Milvus online, mas para executar precisa de Mongo ativo.
Para RAG real, configure `OPENAI_API_KEY`, `MILVUS_ADDRESS` e `COLLECTION_NAME`.

## Empacotar como npm standalone

A pasta `npm_canvas_flow` cria uma embalagem estilo Node-RED: um pacote com CLI
global que sobe backend e frontend juntos.

Experiência de usuário final quando publicado no npm:

```bash
npx @igoruehara/canvas-flow@latest --with-docker --open
```

Se o usuário já tiver MongoDB local rodando:

```bash
npx @igoruehara/canvas-flow@latest --open
```

Desenvolvimento/publicação local do pacote:

```bash
cd npm_canvas_flow
npm run bundle
npm install -g .
canvas-flow
```

O primeiro start cria `~/.canvas-flow/config.json`. Edite esse arquivo para
trocar Mongo, Milvus, OpenAI, Azure, SQS e demais configs privadas sem mexer nos
`.env` atuais de `frontend` e `backend`.

Comandos úteis para configurar depois da instalação:

```bash
# Sobe Mongo local via Docker
canvas-flow infra up

# Sobe Mongo + Milvus/MinIO/etcd para RAG local
canvas-flow infra up --full

# Sobe a infra Docker antes de iniciar e abre o navegador
canvas-flow --with-docker --open

# Mostra onde está o config.json ativo
canvas-flow config

# Abre o config.json no editor padrão
canvas-flow config --edit

# Mostra o JSON no terminal
canvas-flow config --show

# Usa um config.json específico
canvas-flow --config C:\canvas-flow\config.json

# Valida bundle, config, Mongo e hardening básico antes de publicar
canvas-flow doctor

# Para os containers, mantendo volumes
canvas-flow infra down
```

Observação: `config.json` contém valores privados, como tokens e secrets
gerados. Use `--show` com cuidado e não cole esse conteúdo em logs públicos.

O pacote npm não deve ser refeito do zero quando frontend/backend evoluem. Ele é
uma embalagem gerada: rode `npm run bundle` para copiar o `frontend/dist` e o
`backend/dist` atuais para dentro de `npm_canvas_flow`.

Para gerar um tarball local:

```bash
cd npm_canvas_flow
npm run pack:local
npm install -g igoruehara-canvas-flow-0.1.10.tgz
canvas-flow
```

## Produção Controlada

Antes de colocar um cliente real, rode os gates de build, testes, audit e
doctor descritos em `docs/PRODUCTION_READINESS.md`.

Arquivos de referência:
- `backend/.env.production.example`
- `npm_canvas_flow/templates/config.production.example.json`
- `.github/workflows/aws.yml` roda testes e audit antes do deploy backend.
