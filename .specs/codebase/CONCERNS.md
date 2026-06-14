# Codebase Concerns

**Analysis Date:** 2026-06-13

## Tech Debt

**Monolithic service files:**

- Issue: Lógica crítica concentrada em arquivos extremamente grandes, dificultando review, testes e refatoração segura.
- Files: `backend/src/runner/runner-service.ts` (~15.045 linhas), `backend/src/rag/rag-service.ts` (~3.113 linhas), `frontend/src/App.tsx` (~8.827 linhas)
- Why: Crescimento orgânico de features (RAG, MCP, WhatsApp, LangGraph, artifacts) no mesmo arquivo.
- Impact: Alto risco de regressão; onboarding lento; merges conflituosos; cobertura de testes superficial apesar de specs existentes.
- Fix approach: Extrair por domínio (step executors, channel handlers, trace, MCP client, UI panels) em módulos menores com interfaces estáveis; manter `RunnerService` como orquestrador fino.

**Generated npm artifacts versionados:**

- Issue: `npm_canvas_flow/public/` e `npm_canvas_flow/server/` contêm builds compilados no git — podem divergir do source ou gerar diffs ruidosos.
- Files: `npm_canvas_flow/public/assets/*`, `npm_canvas_flow/server/**/*.js`
- Why: Pacote npm precisa de artefatos prontos para publish; bundle manual commitado.
- Impact: PRs misturam lógica com assets gerados; risco de publicar build desatualizado se esquecer `npm run bundle`.
- Fix approach: Automatizar bundle no CI antes de publish; considerar `.gitignore` dos dists npm com build só no pipeline de release.

**Dual config surface:**

- Issue: Mesmas settings existem em `.env`, `config.json` e dezenas de env vars mapeadas pelo CLI — fácil inconsistência.
- Files: `backend/.env.example`, `npm_canvas_flow/templates/config.example.json`, `npm_canvas_flow/bin/canvas-flow.js`
- Why: Suportar dev local e standalone npm com UX Node-RED-like.
- Impact: Bugs "funciona local mas não no npx"; documentação removida (`docs/` deletada) aumenta risco.
- Fix approach: Recriar contrato de config em `.specs/` ou README; testes do CLI validando mapeamento env; `doctor` cobrindo todos os campos críticos.

## Known Bugs

_Nenhum bug confirmado com reprodução documentada nesta análise estática. Validar issues abertas no GitHub antes de implementar._

## Security Considerations

**Default JWT secret in dev:**

- Risk: Token forgery se `CANVAS_FLOW_JWT_SECRET` e `CANVAS_FLOW_API_TOKEN` não forem sobrescritos.
- Files: `backend/src/auth/auth-service.ts` — fallback `'canvas-flow-dev-secret'`
- Current mitigation: `production-guard.ts` exige secrets fortes quando `NODE_ENV=production`; CLI gera secrets no `init`.
- Recommendations: Falhar startup em qualquer ambiente exposto se secret for default; nunca logar tokens via `config --show` em ambientes compartilhados.

**Login disabled by default in standalone:**

- Risk: UI admin exposta sem autenticação se `auth.login=false` e instância acessível publicamente.
- Files: `npm_canvas_flow/templates/config.example.json`, `production-guard.ts` (warn `login_disabled`)
- Current mitigation: Warning em production guard; README alerta sobre boundary privado.
- Recommendations: `doctor --strict` deve falhar se `publicUrl` não for localhost e login estiver off.

**Secrets in provider config:**

- Risk: API keys LLM armazenadas no Mongo — comprometimento do DB expõe todos os providers.
- Files: `backend/src/provider-config/provider-config-service.ts` (cipher AES)
- Current mitigation: Criptografia com chave derivada; `secretStatus` não expõe valores ao frontend.
- Recommendations: Documentar rotação de chave de criptografia; audit de endpoints que retornam settings.

**CORS permissive in non-production:**

- Risk: Sem `CORS_ORIGINS`, dev aceita qualquer origin (`main.ts` resolveCorsOrigin).
- Files: `backend/src/main.ts`, `backend/src/lambda.ts`
- Current mitigation: Production exige origins explícitos; wildcard bloqueado por production guard.
- Recommendations: Manter comportamento; garantir `NODE_ENV=production` em deploy real.

## Performance Bottlenecks

**Large in-memory flow execution:**

- Problem: `RunnerService` processa fluxos complexos sincronamente na request HTTP; traces grandes consumem memória.
- Files: `backend/src/runner/runner-service.ts` (TraceBuffer, collectLimit/responseLimit)
- Measurement: Não medido nesta análise — validar p95 em fluxos com RAG + MCP + múltiplos steps.
- Cause: Execução monolítica single-process; LangGraph checkpoint I/O adicional.
- Improvement path: SQS path já existe para async; expandir uso; paginar traces; limites configuráveis já presentes — documentar tuning (`maxParallelNodes`, trace modes).

**RAG Milvus scan:**

- Problem: `RagService` pode fazer scans extensos em metadata ordering (`metadataOrderMaxScan` configs).
- Files: `backend/src/rag/rag-service.ts`
- Cause: Queries complexas com filtros dinâmicos por agente.
- Improvement path: Índices Milvus por agentId; cache de schema Azure; benchmarks por collection size.

## Fragile Areas

**RunnerService — flow step interpreter:**

- Files: `backend/src/runner/runner-service.ts`, `backend/src/runner/langgraph-runtime.service.ts`
- Why fragile: Superfície enorme; múltiplos tipos de step; integrações MCP/SQS/WhatsApp; mudança em um step pode quebrar outros.
- Common failures: Regressão em condition evaluation; MCP transport timeout; provider resolution returning empty config.
- Safe modification: Escrever spec antes de alterar; usar mocks existentes em `runner-service.spec.ts`; testar via `POST /api/canvas-flow/test`.
- Test coverage: Spec extenso (~3k linhas) mas não cobre 100% da superfície.

**NPM bundle pipeline:**

- Files: `npm_canvas_flow/scripts/build-package.mjs`, `npm_canvas_flow/bin/canvas-flow.js`
- Why fragile: Sync de dependencies backend→npm package.json; copy de dist; env injection manual.
- Common failures: Frontend build com URL errada; server dist stale; dependency mismatch no publish.
- Safe modification: Sempre rodar `npm run bundle` + `canvas-flow doctor` antes de publish.
- Test coverage: Nenhum teste automatizado.

**Provider config encryption:**

- Files: `backend/src/provider-config/provider-config-service.ts`
- Why fragile: Mudança no schema de settings afeta runner, rag e frontend modal simultaneamente.
- Safe modification: Atualizar `types/flow.ts`, API response shape, e specs em conjunto.

## Scaling Limits

**Single Node standalone:**

- Current capacity: Um processo Node serve API + static + runner; `maxParallelNodes: 50` default.
- Limit: CPU/memória do host; Mongo connection pool; Milvus latency.
- Symptoms at limit: Timeouts em test flow; OOM em traces full mode; SQS backlog se processor não escalar.
- Scaling path: Deploy Lambda + SQS workers; Mongo Atlas; Zilliz Cloud; horizontal Lambda concurrency.

**Mongo as queue metadata store:**

- Current capacity: Job/lock/dedupe collections com TTL.
- Limit: Write contention em alto volume WhatsApp.
- Scaling path: Redis para locks; SQS FIFO com dedupe nativo.

## Dependencies at Risk

**Legacy peer deps in CI:**

- Risk: `npm ci --legacy-peer-deps` mascara conflitos de peer dependencies.
- Files: `.github/workflows/aws.yml`
- Impact: Upgrades NestJS/LangChain podem quebrar silenciosamente.
- Migration plan: Resolver peer conflicts; remover `--legacy-peer-deps` quando possível.

**Milvus Docker `latest` tag:**

- Risk: `milvusdb/milvus:latest` em docker-compose pode quebrar compatibilidade SDK 2.6.11.
- Files: `docker-compose.yml`
- Migration plan: Fixar versão Milvus compatível com SDK.

## Missing Critical Features

**Documentação operacional (docs/ removida):**

- Problem: Pasta `docs/sdd/` foi removida; README referencia `docs/PRODUCTION_READINESS.md` que pode não existir mais.
- Files: `README.md` linha ~214
- Current workaround: README root + `.specs/codebase/` (este mapping).
- Blocks: Onboarding e release checklist formal.
- Implementation complexity: Baixa — recriar via TLC `Initialize project` + specs de release.

## Test Coverage Gaps

**Frontend (App.tsx + components):**

- What's not tested: Toda UI — editor, inspector, modais, API client edge cases.
- Risk: Regressões visuais e de fluxo de save/test undetected.
- Priority: High
- Difficulty to test: Média — precisa Vitest + Testing Library ou Playwright.

**HTTP integration tests:**

- What's not tested: Controllers end-to-end com supertest (lib já instalada).
- Risk: Auth header regressions; DTO validation gaps.
- Priority: Medium
- Difficulty to test: Média — precisa Mongo test container ou mock module.

**CLI canvas-flow.js:**

- What's not tested: init, config mapping, doctor, infra commands.
- Risk: Breaking changes no publish npm.
- Priority: High for release path
- Difficulty to test: Média — node:test com fixtures de config temp.

**Channel integrations (WhatsApp webhooks):**

- What's not tested: Payload parsing em `SqsTransitionService.getConversationId()` — muitos formatos de fallback.
- Risk: Mensagens perdidas ou roteamento errado por mudança de payload Meta.
- Priority: High for production WhatsApp
- Difficulty to test: Baixa — fixtures JSON + unit tests.

---

_Concerns audit: 2026-06-13_
_Update as issues are fixed or new ones discovered_
