# Canvas Flow

**Visão:** Workspace open source para criar, testar e executar agentes de IA em fluxos visuais, com canais prontos para atendimento (WhatsApp, Web Widget) e automação via API/webhooks.

**Público:** Desenvolvedores e equipes que precisam prototipar e operar agentes conversacionais com RAG, memória e integrações MCP — localmente via npm ou em produção na AWS.

**Problema que resolve:** Construir agentes conversacionais exige orquestrar LLM, RAG, memória, canais e integrações HTTP/MCP — tarefa fragmentada entre código, configs e ferramentas. Canvas Flow unifica editor visual, execução (LangGraph), persistência e deploy em um produto standalone.

**Site:** https://igoruehara.github.io/canvas-flow/

## Goals

- **Adoção npm:** Usuário consegue subir instância completa com `npx @igoruehara/canvas-flow --open` em < 15 min (Mongo local ou Atlas).
- **Confiabilidade de execução:** Fluxos de teste (`POST /api/canvas-flow/test`) completam com sucesso em ≥ 95% dos casos em ambiente configurado (Mongo + provider LLM).
- **Onboarding dev:** Novo contribuidor sobe frontend + backend local seguindo README em < 30 min.
- **Qualidade backend:** Pipeline CI (`npm test --runInBand`) passa antes de deploy Lambda; zero regressões em production guard.
- **Documentação operacional:** Checklist de release e arquitetura vivem em `.specs/` com rastreabilidade TLC — substituindo `docs/sdd/` removida.

## Tech Stack

**Core:**

- **Frontend:** React 18 + Vite 6 + React Flow 11 + TypeScript 5.7
- **Backend:** NestJS 11 + Mongoose 8 + TypeScript 5.7
- **Database:** MongoDB 7 (obrigatório)
- **Vector DB:** Milvus/Zilliz (opcional, RAG)
- **Runtime:** LangGraph 1.3 + checkpoints MongoDB
- **Deploy:** AWS Lambda (Serverless) + SQS (async opcional)
- **Distribuição:** Pacote npm `@igoruehara/canvas-flow` (CLI standalone)

**Dependências críticas:** openai, @langchain/langgraph, @zilliz/milvus2-sdk-node, @modelcontextprotocol/sdk, @aws-sdk/client-sqs

## Scope

**v1 inclui (já construído):**

- Editor visual de fluxos (nós: mensagem, input, API/httpBatch, condição, fim, encapsulador, RAG IA Gen, Debug)
- CRUD de fluxos, agentes e versionamento (Mongo)
- Execução de fluxos via Runner + LangGraph checkpoints
- RAG com embeddings OpenAI/Azure + Milvus; ingestão DOCX/XLSX/PDF
- Memória conversacional por `agentId + conversationId`
- Tool httpBatch para IA chamar APIs externas
- Painel de teste real no editor
- Auth opcional (JWT + API keys)
- Provider config multi-LLM (OpenAI, Azure, Gemini, Claude, Grok, Bedrock)
- MCP OAuth + ferramentas externas
- Canais WhatsApp (Meta Embedded Signup) e Web Widget
- CLI npm standalone (`canvas-flow init`, `doctor`, `infra up`)
- Deploy AWS Lambda via GitHub Actions

**Near-term (em progresso):**

- Formalização TLC: `.specs/project/`, `.specs/features/`, roadmap
- Hardening provider-config e runner/SQS
- Recriação de checklist operacional de release
- Gates `doctor --strict` e testes CLI

**Explicitamente fora de escopo:**

- Marketplace de templates/plugins de terceiros
- Multi-tenancy SaaS gerenciado (billing, isolamento por tenant)
- Colaboração real-time multi-usuário no editor
- Fine-tuning de modelos
- Microserviços (permanece monolith modular NestJS)
- Novos canais além de WhatsApp, Web Widget, API e webhooks

## Constraints

- **Técnicos:** MongoDB obrigatório em runtime; Milvus opcional; secrets nunca versionados; `frontend/` e `backend/` são fonte da verdade — `npm_canvas_flow/public` e `server/` são artefatos gerados.
- **Segurança:** `config.json` privado em `~/.canvas-flow/`; production guard exige secrets fortes; login desabilitado em standalone exige boundary de rede confiável.
- **Operacionais:** Pacote npm publicado manualmente após `npm run bundle`; CI deploy backend apenas em branches dev/hml/prd.
- **Documentação:** Pasta `docs/` removida — toda doc viva migra para `.specs/` (TLC Spec-Driven).
