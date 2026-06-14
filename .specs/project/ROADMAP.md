# Roadmap

**Milestone Atual:** Fundação e Estabilização  
**Status:** In Progress

---

## Milestone 1 — Fundação e Estabilização

**Objetivo:** Consolidar a base do produto já entregue, restaurar documentação operacional, formalizar specs em `.specs/` e estabelecer gates repetíveis (`doctor`, `bundle`, checklist de produção) antes de escalar clientes reais.

**Meta:** Critério de conclusão — novo desenvolvedor consegue subir o projeto, publicar o pacote npm e passar checklist de produção sem depender de conhecimento tribal; `.specs/project/` e `.specs/codebase/` cobrem arquitetura, integrações e release.

### Features

**Editor Visual de Fluxos** — COMPLETE

- Canvas React Flow com nós: mensagem, input, API/httpBatch, condição, fim e encapsulador
- Biblioteca de componentes reduzidos (`RAG IA Gen`, `Debug`)
- Inspector, tags, versionamento visual e persistência de layout

**CRUD de Fluxos e Agentes** — COMPLETE

- Criar, editar, duplicar e versionar fluxos via API REST
- Associação de agentes a canais (WhatsApp, Web Widget, API, webhooks)
- Draft + histórico de versões persistidos em MongoDB

**Autenticação Opcional** — COMPLETE

- Login JWT + registro quando `auth.login=true`
- Modo standalone sem login para dev local (com aviso em produção)
- Tokens de UI (`x-canvas-flow-token`) e API keys para integradores

**Pacote npm Standalone** — COMPLETE

- CLI `canvas-flow` sobe backend + frontend no mesmo processo Node
- Config privado em `~/.canvas-flow/config.json` sem versionar secrets
- Comandos `infra up/down`, `config`, `--with-docker` e `--open`

**Atualização do Bundle npm** — IN PROGRESS

- Pipeline `npm run bundle` sincroniza `frontend/dist` e `backend/dist` para `npm_canvas_flow/`
- Artefatos gerados versionados no git — risco de drift entre source e publish
- README do pacote atualizado; novos assets de frontend pendentes de commit consistente

**Documentação `.specs/`** — IN PROGRESS

- Mapping de codebase: `ARCHITECTURE`, `STACK`, `STRUCTURE`, `CONVENTIONS`, `INTEGRATIONS`, `CONCERNS`, `TESTING`
- `PROJECT.md` e `ROADMAP.md` (este documento) formalizam visão e fases
- Substituir conhecimento perdido com a remoção de `docs/sdd/`

**Produção Controlada e Gates de Release** — IN PROGRESS

- Checklist `docs/PRODUCTION_READINESS.md` removido — precisa ser recriado ou migrado para `.specs/`
- Comando `canvas-flow doctor` valida bundle, config, Mongo e hardening básico
- CI GitHub Actions (`aws.yml`) roda testes e audit antes do deploy backend
- Templates `config.production.example.json` e `.env.production.example` existentes

**Doctor e Validação de Config** — PLANNED

- `doctor --strict` falha se instância pública exposta com login desabilitado
- Cobertura de todos os campos críticos do mapeamento `config.json` → env vars
- Testes automatizados do CLI (`init`, `config`, `doctor`, `infra`)

---

## Milestone 2 — Provider e Runtime Hardening

**Objetivo:** Tornar a resolução de provedores LLM e a execução de fluxos previsíveis, seguras e testáveis em produção — reduzindo regressões no `RunnerService` e no modal de providers.

**Meta:** Critério de conclusão — alterações em provider-config ou runner passam por specs; secrets rotacionáveis; traces e limites documentados; provider resolution nunca retorna config vazia silenciosamente.

### Features

**Configuração de Provedores (UI + API)** — IN PROGRESS

- Modal de providers no frontend para OpenAI, Azure, Gemini, Claude, Grok, Bedrock
- API keys criptografadas no Mongo com `secretStatus` sem expor valores
- Merge de settings por escopo: global → agent → env (`getEffectiveSettings`)
- Melhorias em andamento: novos campos, validação de schema, integração runner/RAG

**Resolução Multi-LLM no Runtime** — IN PROGRESS

- `ProviderConfigService` consumido por `RunnerService` e `RagService`
- Suporte a embeddings e chat por provider configurado
- Runner atualizado (+300 linhas) para usar settings efetivos em steps LLM e RAG

**Execução de Fluxos (Runner + LangGraph)** — COMPLETE

- Interpretação de steps: mensagem, input, condição, componente, API, fim, group
- Trace configurável (`collectLimit`, `responseLimit`, modos full/summary)
- Checkpoints LangGraph persistidos em Mongo entre invocações

**Transições SQS no Runner** — IN PROGRESS

- `SqsTransitionService` enfileira jobs de webhook com dedupe e TTL em Mongo
- `RunnerQueueProcessor` consome fila e invoca `RunnerService`
- Ajustes recentes em parsing de `conversationId` e integração com runner

**RAG com Embeddings e Vector Store** — COMPLETE

- OpenAI/Azure embeddings + busca Milvus/Zilliz ou Azure Search
- Ingestão de documentos DOCX, XLSX, PDF
- Componente `RAG IA Gen` no canvas aciona chat RAG contextualizado

**Memória Conversacional** — COMPLETE

- Histórico por `agentId + conversationId` em Mongo
- Turnos injetados automaticamente em execuções subsequentes

**Tool httpBatch** — COMPLETE

- IA invoca APIs HTTP externas durante RAG ou nós `api`
- Headers, body templates e autenticação por request no step

**Painel de Teste de Fluxo** — COMPLETE

- Simulação real via `POST /api/canvas-flow/test` no editor
- Trace visual de steps executados no frontend

**API Keys e MCP OAuth** — COMPLETE

- CRUD de API keys para integradores externos
- Fluxo OAuth2 para servidores MCP protegidos; tokens persistidos

**Testes do Runner** — PLANNED

- Expandir `runner-service.spec.ts` para novos paths de provider resolution
- Fixtures JSON para payloads WhatsApp/SQS em `getConversationId()`
- Testes HTTP end-to-end com supertest para controllers críticos

---

## Milestone 3 — Escala e Canais

**Objetivo:** Operar agentes em volume real — WhatsApp em produção, fila assíncrona confiável, deploy cloud escalável e observabilidade mínima.

**Meta:** Critério de conclusão — webhook WhatsApp processado via SQS sem perda de mensagens; Lambda escala sob carga; Web Widget embeddable documentado; limites de trace e tuning documentados.

### Features

**Deploy AWS Lambda** — COMPLETE

- Serverless Framework com imagem Docker em ECR
- Pipeline CI/CD por stage (dev/hml/prd) via GitHub Actions
- Handler `lambda.ts` com CORS e production guard

**Fila Assíncrona SQS** — COMPLETE

- Opt-in via `CANVAS_FLOW_SQS=true` e `CANVAS_FLOW_SQS_QUEUE_URL`
- Job metadata, locks, dedupe e rate-limit em collections Mongo
- Cron scan de jobs pendentes configurável

**WhatsApp Business (Meta)** — COMPLETE

- Embedded Signup (preset Sinergy) e modo self-hosted (App ID próprio)
- Conexão manual via WABA ID, Phone Number ID e access token
- Webhook → runner direto ou via fila SQS

**WhatsApp em Produção** — PLANNED

- Testes automatizados de parsing de payloads Meta (múltiplos formatos fallback)
- Monitoramento de backlog SQS e jobs TTL expirados
- Documentação de onboarding self-hosted vs Sinergy gerenciado
- Hardening de rate-limit e dedupe sob alto volume

**Web Widget** — COMPLETE

- Canal web embeddable por agente
- Preview no frontend e config via `createWebWidgetConfig`

**Armazenamento de Arquivos (S3 / Azure Blob)** — COMPLETE

- Documentos e artifacts via S3 ou Azure Blob conforme config
- Presigned URLs para download seguro

**Observabilidade e Tuning** — PLANNED

- Documentar `maxParallelNodes`, trace modes e limites de memória
- Métricas p95 em fluxos RAG + MCP + múltiplos steps
- Alertas para SQS backlog e falhas de processor

**Escalabilidade Horizontal** — PLANNED

- Concurrency Lambda configurável por stage
- Considerar Redis para locks em substituição a Mongo em alto volume WhatsApp
- Índices Milvus por `agentId` para reduzir scan em RAG

---

## Considerações Futuras

**Refatoração de Monolitos** — PLANNED

- `backend/src/runner/runner-service.ts` (~15k linhas): extrair step executors, channel handlers, trace buffer, MCP client
- `frontend/src/App.tsx` (~8.8k linhas): extrair painéis (editor, inspector, test) em componentes/hooks
- `backend/src/rag/rag-service.ts` (~3k linhas): separar ingestão, search e LLM chat
- Manter `RunnerService` como orquestrador fino com interfaces estáveis

**Testes de Frontend** — PLANNED

- Vitest + Testing Library ou Playwright para editor, modais e fluxo save/test
- Prioridade alta dado risco de regressão visual

**Pipeline npm no CI** — PLANNED

- Automatizar `npm run bundle` + `doctor` no pipeline de release
- Considerar `.gitignore` de dists npm com build exclusivo no publish

**Dependências e Infra** — PLANNED

- Remover `--legacy-peer-deps` do CI quando conflitos resolvidos
- Fixar versão Milvus no docker-compose (evitar tag `latest`)
- Resolver peer conflicts NestJS/LangChain

**Multi-tenant e RBAC** — PLANNED

- Escopo de agentes/fluxos por organização
- Roles admin vs operador no editor

---

## Resumo de Status

| Milestone | Foco | Estado geral |
|-----------|------|--------------|
| 1 — Fundação e Estabilização | Docs, gates, bundle npm | **Ativo** — milestone atual |
| 2 — Provider e Runtime | Provider-config, runner, SQS | **Parcialmente ativo** |
| 3 — Escala e Canais | WhatsApp prod, observabilidade | Base entregue; hardening pendente |
| Futuro | Refatoração, testes UI, CI npm | Planejado |

**Trabalho em andamento (git/concerns):** melhorias em `provider-config-service`, integração runner/SQS, refresh do bundle npm, recriação de documentação operacional removida de `docs/sdd/` e `PRODUCTION_READINESS.md`.
