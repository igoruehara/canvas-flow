# Provider Config — Especificação

## Problem Statement

O Canvas Flow precisa conectar-se a múltiplos provedores de LLM (OpenAI, Azure OpenAI, Gemini, Claude, Grok, Bedrock) e serviços auxiliares (Milvus, Azure Blob/Search, WhatsApp, web widget) para executar fluxos, RAG e canais. Hoje existem **três superfícies de configuração** — variáveis de ambiente (`.env` ou `config.json` do CLI), documentos Mongo criptografados editáveis pela UI, e escolha de `llmProvider` por agente no editor — sem contrato formal que descreva precedência, herança e comportamento esperado.

Operadores precisam configurar credenciais uma vez (global ou por agente), ver status de proveniência sem expor segredos, e garantir que runner e RAG resolvam a mesma config efetiva em dev, standalone npm e Lambda. Mudanças recentes expandiram suporte multi-LLM e `providerStatus` na API; esta spec consolida o comportamento **como deve funcionar**, incluindo melhorias implícitas e lacunas identificadas no código.

## Goals

- [ ] Operador configura credenciais e modelos de **todos os LLM providers suportados** via modal ou `config.json`, com segredos **nunca retornados em texto claro** pela API.
- [ ] Sistema resolve config **efetiva por agente** (merge env → global Mongo → agent Mongo) e a consome de forma idêntica em **RunnerService** e **RagService**.
- [ ] UI exibe **status de proveniência** (`agent`, `global`, `env`, `none`) e permite escopo **global vs agente** com herança documentada.
- [ ] Standalone npm mapeia `providers.*` de `~/.canvas-flow/config.json` para env vars reconhecidas pelo backend, alinhado ao schema do serviço.

## Out of Scope

Explicitamente excluído. Documentado para evitar creep de escopo.

| Feature | Reason |
| ------- | ------ |
| Rotação automática de chave AES de criptografia | Não implementada; requer migração de documentos existentes — documentar como operação manual futura |
| Sincronização bidirecional Mongo ↔ `config.json` | CLI injeta env no boot; UI grava Mongo; não há export/import automático |
| OAuth MCP (Figma, Canvas MCP) na UI de Provedores | Campos existem em `config.example.json` e env, mas **fora** de `ProviderConfigService.allowedSections` |
| Testes E2E automatizados do modal | Gap conhecido em CONCERNS.md; cobertura será fase de validação separada |
| Seleção de `llmProvider` no modal global | Permanece no **Agent Studio / Inspector** (`FlowConfig.llmProvider`); provider-config armazena **credenciais**, não a escolha por fluxo |
| IAM nativo AWS Bedrock (sem gateway OpenAI-compatible) | Bedrock usa gateway OpenAI-compatible (`baseUrl` + `apiKey`); credenciais IAM diretas ficam fora deste contrato |

---

## User Stories

### P1: Configurar credenciais LLM globalmente via UI ⭐ MVP

**User Story**: Como operador da plataforma, quero cadastrar API keys e modelos padrão de OpenAI, Azure, Gemini, Claude, Grok e Bedrock no escopo global, para que todos os agentes possam usar LLM sem editar `.env`.

**Why P1**: Sem credenciais persistidas e seguras, nenhum fluxo executa chat, embedding ou OCR; é o núcleo do produto.

**Acceptance Criteria**:

1. WHEN operador autenticado abre o modal de Provedores no escopo **Global** THEN sistema SHALL carregar `GET /api/provider-config` retornando `settings` com campos secretos vazios, `secretStatus` indicando presença, e valores não-secretos (modelos, endpoints, deployments).
2. WHEN operador informa API key de um provider LLM e clica **Salvar** THEN sistema SHALL persistir no Mongo com prefixo `enc:` (AES-256-GCM), invalidar cache efetivo, e retornar resposta segura sem expor o valor salvo.
3. WHEN operador salva campo secreto em branco em update parcial THEN sistema SHALL **preservar** o segredo existente no escopo (não sobrescrever com vazio).
4. WHEN operador configura Azure OpenAI THEN sistema SHALL exigir `endpoint` + `apiKey` e aceitar `chatDeploymentName`, `embeddingDeploymentName`, `ocrDeploymentName` e `embeddingDimensions`.
5. WHEN operador configura Bedrock THEN sistema SHALL exigir `apiKey` + `baseUrl` (gateway OpenAI-compatible) além de `region` e `chatModel`.

**Independent Test**: Abrir modal → Global → OpenAI → informar API key → Salvar → recarregar modal → ver hint "Já configurado" e `secretStatus['openai.apiKey'] === true` sem valor visível.

---

### P1: Sobrescrever config por agente com herança ⭐ MVP

**User Story**: Como operador, quero definir credenciais ou modelos específicos para um agente, herdando o restante do escopo global ou env, para isolar tenants ou ambientes dentro da mesma instância.

**Why P1**: Multi-agente é requisito central; herança evita duplicação e erros de configuração.

**Acceptance Criteria**:

1. WHEN operador alterna escopo para **Agente atual** THEN sistema SHALL chamar `GET /api/provider-config?agentId={id}` e exibir `providerStatus[section].source` como `agent`, `global`, `env` ou `none`.
2. WHEN agente não possui seção salva mas global possui THEN sistema SHALL resolver valores efetivos do global na resposta e marcar `providerStatus[section].inherited === true` e label UI **"Herdado do global"**.
3. WHEN operador salva seção no escopo agente THEN sistema SHALL persistir documento Mongo com `key = agent:{agentId}` contendo apenas patch da seção, sem alterar config global.
4. WHEN `getEffectiveSettings(agentId)` é invocado THEN sistema SHALL aplicar merge `deepMergeFallback(env, globalStored, agentStored)` ignorando strings vazias no override.
5. WHEN operador exclui seção no escopo agente THEN sistema SHALL remover apenas override agente; valores globais/env voltam a valer na resolução efetiva.

**Independent Test**: Configurar OpenAI global → alternar para agente → salvar Gemini key no agente → testar fluxo do agente usando Gemini enquanto outro agente continua com OpenAI global.

---

### P1: Resolução runtime unificada para runner e RAG ⭐ MVP

**User Story**: Como desenvolvedor de fluxos, quero que execução de chat, embeddings e OCR use a mesma config efetiva resolvida por agente, para evitar "funciona no teste mas falha no RAG".

**Why P1**: Runner e RAG são consumidores críticos; divergência quebra confiança no produto.

**Acceptance Criteria**:

1. WHEN `RunnerService` executa step LLM para `agentId` THEN sistema SHALL chamar `ProviderConfigService.getEffectiveSettings(agentId)` e `toOpenAIRuntimeConfig(settings, flowLlmProvider)`.
2. WHEN `RagService` gera embeddings ou chat RAG THEN sistema SHALL usar o mesmo par `getEffectiveSettings` + `toOpenAIRuntimeConfig` com o provider normalizado do agente.
3. WHEN `llmProvider` selecionado no fluxo não possui credenciais configuradas THEN `normalizeEffectiveSettings` SHALL fazer fallback automático para o primeiro provider LLM com credenciais válidas (ordem: openai → azure → gemini → claude → grok → bedrock).
4. WHEN Mongo indisponível no boot (`readyState !== 1`) THEN sistema SHALL degradar para `getEnvSettings()` normalizado, sem falhar startup.
5. WHEN config efetiva é lida repetidamente dentro de `CANVAS_FLOW_PROVIDER_CACHE_MS` THEN sistema SHALL servir cache in-memory por chave (`global` ou `agent:{id}`) até invalidação em write.

**Independent Test**: Configurar Gemini no provider-config → definir `llmProvider: gemini` no agente → `POST /api/canvas-flow/test` retorna resposta LLM via Gemini; ingest RAG usa embedding do provider configurado.

---

### P1: API REST segura e autenticada ⭐ MVP

**User Story**: Como administrador, quero endpoints REST protegidos para ler e alterar provider config, para integrar automações sem vazar segredos.

**Why P1**: Superficie exposta na internet (standalone/Lambda); vazamento de API keys é risco crítico documentado em CONCERNS.md.

**Acceptance Criteria**:

1. WHEN request sem auth válida atinge `/api/provider-config` THEN sistema SHALL rejeitar via `AuthService.assertUiAuth` (Bearer JWT, `x-canvas-flow-token`, ou `x-api-key`).
2. WHEN `GET /api/provider-config` succeeds THEN response SHALL incluir `settings`, `secretStatus` e `providerStatus` e **nunca** valores descriptografados de paths em `SECRET_PATHS`.
3. WHEN `PUT /api/provider-config` recebe `llmProvider` inválido THEN sistema SHALL retornar `400` com mensagem `llmProvider invalido.`
4. WHEN `DELETE /api/provider-config/:section` com section desconhecida THEN sistema SHALL retornar `400 Provider invalido.`
5. WHEN Mongo não conectado em write (`updateSettings`, `clearSection`, embedded signup) THEN sistema SHALL retornar `400` informando Mongo indisponível.

**Independent Test**: Chamar GET sem token → 401/403; GET com token → keys mascaradas; PUT parcial → secrets preservados; DELETE `openai` → seção removida do escopo.

---

### P2: Bootstrap standalone via config.json

**User Story**: Como usuário do pacote npm, quero definir providers em `~/.canvas-flow/config.json` para subir a instância sem Mongo pré-populado pela UI.

**Why P2**: Modo standalone é canal de distribuição principal; env é fallback até operador usar UI.

**Acceptance Criteria**:

1. WHEN CLI `canvas-flow start` carrega config THEN SHALL mapear `providers.openai`, `gemini`, `claude`, `grok`, `bedrock`, `azureOpenAI`, `milvus`, `azureBlob`, `azureSearch`, `mongoComponent`, `webWidget`, `whatsapp` para env vars documentadas em `applyEnvironment()`.
2. WHEN `providers.openai.provider` ou `azureOpenAI.enabled` indicam Azure THEN SHALL setar `OPENAI_PROVIDER` / `AZURE_OPENAI_ENABLED` coerentemente com `getEnvSettings()`.
3. WHEN `runtime.providerCacheMs` está definido THEN SHALL exportar `CANVAS_FLOW_PROVIDER_CACHE_MS`.
4. WHEN operador posteriormente salva config via UI THEN valores Mongo **sobrescrevem** env para campos não-vazios na resolução efetiva (precedência documentada).

**Independent Test**: Preencher `providers.gemini.apiKey` no config.json → `canvas-flow doctor` passa → GET provider-config mostra `source: env` para gemini até override UI.

---

### P2: Onboarding WhatsApp via Embedded Signup

**User Story**: Como operador de canal WhatsApp Meta, quero completar Embedded Signup pela UI e persistir tokens automaticamente, para reduzir configuração manual de WABA e Phone Number ID.

**Why P2**: Fluxo já implementado (`POST /api/provider-config/whatsapp/embedded-signup`); precisa contrato formal.

**Acceptance Criteria**:

1. WHEN operador inicia Embedded Signup no modal com App ID, Config ID e code OAuth THEN frontend SHALL chamar endpoint com `agentId` do escopo atual.
2. WHEN backend recebe code válido THEN SHALL trocar por access token via Graph API, resolver WABA/Phone Number ID, opcionalmente subscrever webhooks, e persistir seção `whatsapp` criptografada.
3. WHEN modo `coexistence` THEN SHALL aplicar preset Sinergy (`embeddedSignupAppId`, `embeddedSignupConfigId`) e habilitar `syncMessageEchoes`.
4. WHEN onboarding conclui THEN response SHALL incluir objeto `onboarding` com IDs resolvidos e status de token/subscribe, além de `settings` seguros.

**Independent Test**: Modo coexistence → Conectar WhatsApp → verificar `phoneNumberId`, `businessAccountId` e `secretStatus['whatsapp.accessToken']` sem expor token.

---

### P2: Integração Inspector ↔ status de providers LLM

**User Story**: Como editor de fluxos, quero ver no Inspector quais LLM providers estão configurados para o agente atual, para escolher `llmProvider` sem surpresas em runtime.

**Why P2**: Ponte entre credenciais (provider-config) e seleção por fluxo (FlowConfig); já parcialmente implementada.

**Acceptance Criteria**:

1. WHEN Inspector carrega config do agente THEN SHALL chamar `getProviderConfig({ agentId })` e marcar providers configurados via `secretStatus` + campos não-secretos.
2. WHEN operador seleciona provider não configurado no dropdown THEN UI SHALL exibir aviso e ainda permitir salvar fluxo (comportamento atual preservado).
3. WHEN evento `canvas-flow-provider-config-updated` é disparado THEN Inspector SHALL recarregar status sem refresh da página.

**Independent Test**: Configurar Claude → salvar modal → Inspector mostra Claude como configurado no dropdown de provider.

---

### P3: Configurar infra auxiliar (Milvus, Azure, Mongo component)

**User Story**: Como operador de RAG, quero configurar Milvus, Azure Blob, Azure Search e MongoDB operacional no mesmo modal, para centralizar integrações de dados.

**Why P3**: Seções existem e são consumidas por RagService/runner; menor prioridade que LLM core.

**Acceptance Criteria**:

1. WHEN operador configura Milvus THEN sistema SHALL persistir address, token, username, password (secretos criptografados) e collectionName.
2. WHEN operador configura Azure Blob/Search THEN connection string e apiKey SHALL ser tratados como secrets.
3. WHEN seção infra não configurada THEN RAG SHALL degradar ou usar env conforme implementação atual de RagService.

**Independent Test**: Configurar Milvus global → ingest RAG conecta à collection configurada.

---

### P3: Personalizar web widget no provider config

**User Story**: Como operador de canal web, quero definir cores, textos e posição do widget no modal e copiar código embed, para publicar chat no site do cliente.

**Why P3**: Feature de canal completa no modal com preview; não bloqueia LLM MVP.

**Acceptance Criteria**:

1. WHEN operador edita seção webWidget THEN SHALL persistir tema (cores, textos, posição, openByDefault) no escopo selecionado.
2. WHEN operador clica copiar código THEN SHALL gerar snippet com `agentId`, `flowId` e tema atual.
3. WHEN webWidget herdado de env THEN `providerStatus.webWidget.source` SHALL ser `env`.

**Independent Test**: Alterar cor principal → preview atualiza → copiar código → snippet contém hex correto.

---

## Edge Cases

- WHEN chave de criptografia (`CANVAS_FLOW_JWT_SECRET` / `CANVAS_FLOW_API_TOKEN` / fallback dev) muda após secrets salvos THEN sistema SHALL falhar silenciosamente na descriptografia (retorna string vazia) — **gap conhecido**: operador deve re-salvar secrets; rotação automática fora de escopo.
- WHEN agente salva override parcial com apenas `chatModel` THEN merge SHALL herdar `apiKey` do escopo superior (global/env).
- WHEN `clearSection('openai')` no global com `llmProvider === 'openai'` armazenado THEN sistema SHALL remover também `llmProvider` do documento global.
- WHEN Bedrock configurado sem `baseUrl` THEN `hasBedrockConfig` SHALL ser false e provider não entra no fallback automático.
- WHEN Azure OpenAI com `enabled: false` no env mas credenciais presentes THEN `normalizeEffectiveSettings` SHALL setar `enabled` true se endpoint+apiKey válidos.
- WHEN request PUT inclui seção WhatsApp com `provider: sinch` e `sinchApiMode: relay` THEN validação de config exige username+serviceToken, não projectId.
- WHEN Mongo lento no primeiro request THEN cache vazio; segundo request dentro de TTL usa cache — writes limpam cache imediatamente.
- WHEN standalone usa secrets só em config.json e operador nunca abre UI THEN resolução efetiva permanece 100% env (`source: env` em todas seções preenchidas).

### Áreas cinzentas (decisão pelo código atual)

| Tema | Decisão adotada |
| ---- | --------------- |
| Precedência env vs Mongo | **Base env**, depois merge Mongo global, depois Mongo agente; Mongo vence apenas campos não-vazios |
| Onde escolher LLM ativo | **`FlowConfig.llmProvider`** por agente/fluxo; provider-config não expõe seletor global de provider ativo no modal |
| Herança UX campos vazios | Formulário mostra valores **efetivos** (merged); salvar grava override no escopo; vazio em secret = manter |
| Rotação de API keys | Operador informa nova key e salva; não há versionamento nem audit log de rotação |

---

## Requirement Traceability

Cada requirement recebe ID único para rastreamento em design, tasks e validação.

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| PROV-01 | P1: API REST segura | Tasks | Verified |
| PROV-02 | P1: Credenciais LLM global UI | Tasks | Verified |
| PROV-03 | P1: API REST segura (preservação secrets) | Tasks | Verified |
| PROV-04 | P1: Escopo agente com herança | Tasks | Verified |
| PROV-05 | P1: Resolução runtime | Tasks | Verified |
| PROV-06 | P1: Credenciais LLM global UI | Tasks | Verified |
| PROV-07 | P1: Escopo agente (DELETE section) | Tasks | Verified |
| PROV-08 | P1: Resolução runtime (cache TTL) | Tasks | Verified |
| PROV-09 | P1: Resolução runtime (toOpenAIRuntimeConfig) | Tasks | Verified |
| PROV-10 | P2: Bootstrap config.json | Tasks | Verified |
| PROV-11 | P2: Inspector ↔ status | Tasks | Verified |
| PROV-12 | P2: WhatsApp Embedded Signup | Tasks | Verified |
| PROV-13 | P1: Resolução runtime (fallback provider) | Tasks | Verified |
| PROV-14 | P1: API REST (validação enums) | Tasks | Verified |
| PROV-15 | P3: Infra auxiliar | Tasks | Verified |

**ID format:** `PROV-[NUMBER]`

**Status values:** Pending → In Design → In Tasks → Implementing → Verified

**Coverage:** 15 total, 15 mapped to tasks, 0 unmapped, 15 verified (backend Jest 147, frontend build, CLI `doctor --offline` — 2026-06-13)

### Detalhamento dos requisitos

| ID | Descrição testável |
| -- | ------------------ |
| PROV-01 | Endpoints `/api/provider-config*` exigem auth UI (`assertUiAuth`) |
| PROV-02 | Secrets em Mongo armazenados com AES-256-GCM (`enc:` + base64url) |
| PROV-03 | PUT parcial com secret vazio preserva valor criptografado existente |
| PROV-04 | Chaves Mongo: `global` e `agent:{agentId}`; merge agent sobre global |
| PROV-05 | `getEffectiveSettings(agentId)` = normalize(deepMergeFallback(env, global, agent)) |
| PROV-06 | Seções LLM: openai, azureOpenai, gemini, claude, grok, bedrock com schema tipado |
| PROV-07 | DELETE `/:section` remove seção do documento do escopo e limpa `llmProvider` associado |
| PROV-08 | Cache in-memory por chave invalidado em write; TTL via `CANVAS_FLOW_PROVIDER_CACHE_MS` |
| PROV-09 | `toOpenAIRuntimeConfig` mapeia settings para consumo OpenAI-compatible no runner/RAG |
| PROV-10 | CLI `applyEnvironment` mapeia `config.providers.*` → env vars equivalentes ao backend |
| PROV-11 | GET retorna `providerStatus[section]` com `configured`, `source`, `scopeConfigured`, `inherited` |
| PROV-12 | POST `whatsapp/embedded-signup` completa OAuth Meta e persiste whatsapp criptografado |
| PROV-13 | `normalizeEffectiveSettings` auto-seleciona primeiro LLM provider com credenciais se seleção inválida |
| PROV-14 | Validação de enums: llmProvider, whatsapp.provider/deliveryMode/onboardingMode, webWidget.position |
| PROV-15 | Seções milvus, azureBlob, azureSearch, mongodb, webWidget persistidas e resolvidas no mesmo pipeline |

---

## Success Criteria

Como sabemos que a feature está correta:

- [ ] Operador configura OpenAI global e executa teste de fluxo com agente default **sem editar `.env`** (< 3 minutos, primeiro uso).
- [ ] Resposta `GET /api/provider-config` **nunca** contém API keys, tokens ou connection strings em texto claro.
- [ ] Agente com override Gemini usa Gemini; agente sem override usa credencial global — verificável via trace/runtime.
- [ ] `canvas-flow start` com `providers.*` preenchido em config.json resulta em `providerStatus.source === 'env'` até override UI.
- [ ] Inspector reflete providers configurados após salvar modal (evento `canvas-flow-provider-config-updated`).
- [ ] Exclusão de seção no escopo agente restaura herança global sem afetar outros agentes.
- [ ] Documentação de precedência (env → global → agent) alinhada entre spec, `.env.example` e `config.example.json`.

---

## Estado atual vs lacunas (brownfield)

| Área | Existe | Lacuna / melhoria |
| ---- | ------ | ----------------- |
| Backend service + encryption | ✅ | Rotação de chave AES não suportada |
| Multi-LLM (6 providers) | ✅ | — |
| Global + agent scope | ✅ | — |
| providerStatus na API | ✅ | — |
| ProviderConfigModal UI | ✅ | Sem seletor `llmProvider` global (by design) |
| Runner/RAG integration | ✅ | — |
| config.json mapping (CLI) | ✅ | `figmaOAuth`/`canvasMcpOAuth` só via env, não UI |
| Testes HTTP provider-config | ❌ | Prioridade média (CONCERNS.md) |
| Testes frontend modal | ❌ | Prioridade alta |
| docs/sdd/configuration.md | ❌ | Substituído por esta spec |

---

_Especificação gerada em fase Specify (TLC Spec-Driven) — 2026-06-13_
