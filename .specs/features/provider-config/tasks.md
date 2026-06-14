# Provider Config Tasks

**Design**: `.specs/features/provider-config/design.md`
**Spec**: `.specs/features/provider-config/spec.md`
**Status**: Complete (T1–T13)
**Last Updated**: 2026-06-13

---

## Execution Plan

### Phase 1: Backend Contract Foundation

```text
T1 -> T2 -> T3
```

### Phase 2: Backend Consumers And CLI

```text
T3 -> T4
T3 -> T5 [P]
T3 -> T6 [P]
T3 -> T7 [P]
```

### Phase 3: Frontend Surfaces

```text
T4 -> T8
T8 -> T9
T8 -> T10
T8 -> T11 [P]
T9 -> T10
```

### Phase 4: Bundle And Feature Validation

```text
T5 + T6 + T7 + T10 + T11 -> T12 -> T13
```

---

## Task Breakdown

### T1: Provider service schema, validation, and secret handling

**What**: Complete the `ProviderConfigService` schema contract for allowed sections, enum validation, secret encryption/masking, and blank-secret preservation.
**Where**: `backend/src/provider-config/provider-config-service.ts`, `backend/src/provider-config/provider-config-service.spec.ts`
**Depends on**: None
**Reuses**: `SECRET_PATHS`, `sanitizeSettingsPatch`, `mergePatchPreservingSecrets`, `walkSecrets`
**Requirement**: PROV-02, PROV-03, PROV-06, PROV-14, PROV-15

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Every secret path in the spec is encrypted at rest and blank in safe GET responses.
- [x] Blank secret updates preserve the existing encrypted value in the same scope.
- [x] Invalid `llmProvider`, WhatsApp enum values, and `webWidget.position` throw `BadRequestException`.
- [x] Infra sections `milvus`, `azureBlob`, `azureSearch`, `mongodb`, and `webWidget` pass through the same sanitize/encrypt pipeline.
- [x] Provider service spec covers the above cases with no skipped tests.
- [x] Gate check passes: `cd backend && npm test -- --runInBand`.
- [x] Test count: backend Jest total is recorded during execution and does not decrease.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(provider-config): harden provider settings contract`
**Result**: Complete on 2026-06-13. Added `provider-config-service.spec.ts`; targeted spec passed 9/9; backend gate passed 9 suites, 126 tests.

---

### T2: Effective settings merge, status, cache, and section delete

**What**: Complete global/agent/env merge behavior, `providerStatus`, effective settings cache TTL/invalidation, provider fallback, and scoped section deletion.
**Where**: `backend/src/provider-config/provider-config-service.ts`, `backend/src/provider-config/provider-config-service.spec.ts`
**Depends on**: T1
**Reuses**: `configKey`, `deepMergeFallback`, `getEffectiveSettings`, `buildProviderStatus`, `clearSection`
**Requirement**: PROV-04, PROV-05, PROV-07, PROV-08, PROV-11, PROV-13

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `global` and `agent:{agentId}` documents merge over env in the documented order.
- [x] Empty strings in higher scopes do not erase inherited effective values.
- [x] `providerStatus[section]` reports `configured`, `source`, `scopeConfigured`, and `inherited`.
- [x] Effective settings cache keys are `global` or `agent:{id}` and writes clear stale entries.
- [x] Deleting a section removes only the selected scope and clears matching stored `llmProvider`.
- [x] Invalid or unconfigured selected provider falls back in the spec order.
- [x] Gate check passes: `cd backend && npm test -- --runInBand`.
- [x] Test count: backend Jest total is recorded during execution and does not decrease.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(provider-config): resolve scoped provider inheritance`
**Result**: Complete on 2026-06-13. Added T2 coverage to `provider-config-service.spec.ts`; targeted spec passed 14/14; backend gate passed 9 suites, 131 tests.

---

### T3: OpenAI-compatible runtime config mapper

**What**: Verify and complete `toOpenAIRuntimeConfig` so every supported LLM provider maps to the runtime fields used by runner and RAG.
**Where**: `backend/src/provider-config/provider-config-service.ts`, `backend/src/provider-config/provider-config-service.spec.ts`
**Depends on**: T2
**Reuses**: `toOpenAIRuntimeConfig`, `OpenAIRuntimeConfig`, existing LLM provider env defaults
**Requirement**: PROV-09, PROV-13

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] OpenAI maps chat, embedding, and OCR model fields.
- [x] Azure maps endpoint, api version, chat/embedding/OCR deployments, and enables Azure only when selected.
- [x] Gemini, Claude, Grok, and Bedrock map API key, base URL/region where applicable, and chat model.
- [x] Provider aliases `azure`, `azure_openai`, and `azure-openai` normalize consistently.
- [x] Gate check passes: `cd backend && npm test -- --runInBand`.
- [x] Test count: backend Jest total is recorded during execution and does not decrease.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(provider-config): map providers to runtime config`
**Result**: Complete on 2026-06-13. Added T3 runtime mapper coverage to `provider-config-service.spec.ts`; targeted spec passed 19/19; backend gate passed 9 suites, 136 tests.

---

### T4: Provider config API auth and endpoint behavior

**What**: Verify all provider-config endpoints require UI auth and delegate safe read/write/delete/onboarding behavior to the service.
**Where**: `backend/src/provider-config/provider-config-controller.ts`, `backend/src/provider-config/provider-config-controller.spec.ts`
**Depends on**: T3
**Reuses**: `AuthService.assertUiAuth`, existing controller spec patterns
**Requirement**: PROV-01, PROV-12, PROV-14

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `GET`, `PUT`, `DELETE`, and `POST whatsapp/embedded-signup` call `assertUiAuth`.
- [x] `agentId` can come from query or body where currently supported.
- [x] Controller responses are service responses without post-processing secrets.
- [x] Controller spec covers auth rejection/delegation and invalid service errors.
- [x] Gate check passes: `cd backend && npm test -- --runInBand`.
- [x] Test count: backend Jest total is recorded during execution and does not decrease.

**Tests**: unit
**Gate**: quick
**Commit**: `test(provider-config): cover provider config api auth`
**Result**: Complete on 2026-06-13. Added `provider-config-controller.spec.ts`; targeted spec passed 6/6; backend gate passed 10 suites, 142 tests.

---

### T5: Runner provider resolution integration [P]

**What**: Finish runner-side provider resolution so LLM execution uses effective settings by agent and selected `FlowConfig.llmProvider`.
**Where**: `backend/src/runner/runner-service.ts`, `backend/src/runner/runner-service.spec.ts`
**Depends on**: T3
**Reuses**: `getProviderSettings`, `getOpenAIClientForProvider`, `getChatModelForProvider`, `resolveRuntimeFlowConfig`
**Requirement**: PROV-05, PROV-09, PROV-13

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Runner resolves provider settings with the active `agentId` for runtime LLM paths.
- [x] Flow/provider aliases normalize before client/model creation.
- [x] Tests cover at least one agent override and one fallback provider path.
- [x] No broad refactor of `RunnerService` is introduced in this task.
- [x] Gate check passes: `cd backend && npm test -- --runInBand`.
- [x] Test count: backend Jest total is recorded during execution and does not decrease.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(runner): use effective provider settings`
**Result**: Complete on 2026-06-13. Added `resolveRuntimeLlmProvider` + `isRuntimeLlmProviderConfigured` (spec-order fallback) and routed `getOpenAIClientForProvider`/`getChatModelForProvider` through the resolved provider; added agent-override and unconfigured-provider-fallback tests to `runner-service.spec.ts`. Backend gate passed 10 suites, 147 tests (up from 142 at T4).

---

### T6: RAG provider and infra settings integration [P]

**What**: Finish RAG-side consumption of effective LLM and infra settings for embeddings, chat, Milvus, Azure Blob, and Azure Search.
**Where**: `backend/src/rag/rag-service.ts`, `backend/src/rag/rag-service.spec.ts`
**Depends on**: T3
**Reuses**: `refreshProviderSettings`, `applyProviderSettings`, `getOpenAIClientForProvider`, existing Milvus/Azure helpers
**Requirement**: PROV-05, PROV-09, PROV-15

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] RAG refreshes effective provider settings before LLM/vector operations that depend on provider config.
- [x] Milvus remote credentials and Azure Blob/Search settings use effective settings.
- [x] Tests cover provider-specific chat/embedding mapping without real external network calls.
- [x] No broad refactor of `RagService` is introduced in this task.
- [x] Gate check passes: `cd backend && npm test -- --runInBand`.
- [x] Test count: backend Jest total is recorded during execution and does not decrease.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(rag): use effective provider settings`
**Result**: Complete on 2026-06-13. Threaded `agentId` through `refreshProviderSettings` and the embedding/chat/Milvus/Azure pipeline so RAG resolves effective per-agent settings; embedding/chat providers now derive from effective `llmProvider`. Added Azure Blob mock plus infra, per-provider chat, and per-provider embedding tests to `rag-service.spec.ts`. Backend gate passed 10 suites, 147 tests.

---

### T7: Standalone config.json to env mapping [P]

**What**: Align standalone `config.json` provider mappings and templates with backend `ProviderSettings`.
**Where**: `npm_canvas_flow/bin/canvas-flow.js`, `npm_canvas_flow/templates/config.example.json`, `npm_canvas_flow/templates/config.production.example.json`, `backend/.env.example`
**Depends on**: T3
**Reuses**: `applyEnvironment`, `setEnv`, `setBoolEnv`, `doctor`
**Requirement**: PROV-10

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `providers.openai`, `azureOpenAI`, `gemini`, `claude`, `grok`, `bedrock`, `milvus`, `azureBlob`, `azureSearch`, `mongoComponent`, `webWidget`, and `whatsapp` map to backend env vars.
- [x] `runtime.providerCacheMs` maps to `CANVAS_FLOW_PROVIDER_CACHE_MS`.
- [x] Azure provider flags set `OPENAI_PROVIDER` / `AZURE_OPENAI_ENABLED` coherently.
- [x] Templates document all fields required by the mapping.
- [x] Gate check passes: `cd npm_canvas_flow && node bin/canvas-flow.js doctor --offline`.

**Tests**: none
**Gate**: full
**Commit**: `feat(cli): map standalone provider config`
**Result**: Complete on 2026-06-13. Worker updated CLI/env templates and backend env example; orchestrator reran `node bin/canvas-flow.js doctor --offline` with 0 failures and 6 expected local/offline warnings.

---

### T8: Frontend provider API and type contract

**What**: Align frontend provider settings types and API methods with the backend response contract.
**Where**: `frontend/src/types/flow.ts`, `frontend/src/lib/api.ts`
**Depends on**: T4
**Reuses**: `CanvasFlowProviderSettings`, `ProviderConfigApiResponse`, `canvasApi`
**Requirement**: PROV-11, PROV-14

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Frontend types include all LLM, infra, web widget, and WhatsApp fields in the spec.
- [x] `ProviderConfigApiResponse` includes safe `settings`, `secretStatus`, `providerStatus`, and optional `onboarding`.
- [x] API methods pass `agentId` consistently for scoped operations.
- [x] Gate check passes: `cd frontend && npm run build`.

**Tests**: none
**Gate**: build
**Commit**: `feat(frontend): type provider config api`
**Result**: Complete on 2026-06-13. Exported provider config response/status types from `flow.ts`, reused them in `api.ts`; frontend build passed.

---

### T9: Provider modal LLM scope, secret, and delete UX

**What**: Finish global/agent LLM provider configuration UX with safe secret hints, provider status labels, scoped saves, and section delete inheritance.
**Where**: `frontend/src/components/ProviderConfigModal.tsx`, `frontend/src/styles.css`
**Depends on**: T8
**Reuses**: `providerConfigured`, `providerStatusLabel`, `SecretHint`, `canvas-flow-provider-config-updated`
**Requirement**: PROV-02, PROV-04, PROV-06, PROV-07, PROV-11

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Global and agent scopes load the correct safe settings and provenance.
- [x] Secret fields show configured hints but never display secret values.
- [x] Blank secret fields on save preserve existing secrets.
- [x] Deleting an agent section restores inherited global/env status without affecting global.
- [x] Successful saves/deletes dispatch `canvas-flow-provider-config-updated`.
- [x] Gate check passes: `cd frontend && npm run build`.

**Tests**: none
**Gate**: build
**Commit**: `feat(frontend): configure scoped llm providers`
**Result**: Complete on 2026-06-13. Verified existing modal scoped provider UX, aligned status types with exported provider config contract, and frontend build passed.

---

### T10: Provider modal WhatsApp, infra, and web widget UX

**What**: Finish provider modal sections for Embedded Signup, Milvus/Azure/Mongo infra, and web widget settings/snippet.
**Where**: `frontend/src/components/ProviderConfigModal.tsx`, `frontend/src/styles.css`
**Depends on**: T9
**Reuses**: existing provider tabs, web widget preview/snippet helpers, WhatsApp onboarding handlers
**Requirement**: PROV-12, PROV-15

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Embedded Signup posts app/config/code fields with scoped `agentId`.
- [x] Onboarding response updates safe settings, `secretStatus`, `providerStatus`, and user feedback.
- [x] Milvus, Azure Blob/Search, MongoDB, and web widget fields save through the same scoped pipeline.
- [x] Web widget snippet contains current `agentId`, `flowId`, and theme values.
- [x] Gate check passes: `cd frontend && npm run build`.

**Tests**: none
**Gate**: build
**Commit**: `feat(frontend): configure channel and infra providers`
**Result**: Complete on 2026-06-13. Verified existing WhatsApp onboarding, infra, and web widget modal behavior; frontend build passed.

---

### T11: Inspector LLM provider status [P]

**What**: Finish Inspector-side provider configured status for the selected agent and warning behavior for unconfigured `llmProvider`.
**Where**: `frontend/src/components/Inspector.tsx`
**Depends on**: T8
**Reuses**: `isFlowProviderConfigured`, `getLlmProviderOptionLabel`, `canvas-flow-provider-config-updated`
**Requirement**: PROV-11

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Inspector fetches provider config for the current `agentId`.
- [x] Provider dropdown labels configured/unconfigured providers correctly.
- [x] Selecting an unconfigured provider shows a warning but still allows saving.
- [x] The status reloads after `canvas-flow-provider-config-updated`.
- [x] Gate check passes: `cd frontend && npm run build`.

**Tests**: none
**Gate**: build
**Commit**: `feat(frontend): show llm provider readiness`
**Result**: Complete on 2026-06-13. Verified existing Inspector provider readiness behavior against T11 criteria; frontend build passed.

---

### T12: NPM bundle sync

**What**: Regenerate package artifacts after backend/frontend/CLI changes and verify standalone package readiness.
**Where**: `npm_canvas_flow/public/**`, `npm_canvas_flow/server/**`, `npm_canvas_flow/public/index.html`, `npm_canvas_flow/package.json` if dependency sync requires it
**Depends on**: T5, T6, T7, T10, T11
**Reuses**: `npm_canvas_flow/scripts/build-package.mjs`
**Requirement**: PROV-10 plus generated artifact coverage for PROV-01..PROV-15

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] `npm run bundle` copies current frontend/backend outputs into `npm_canvas_flow`.
- [x] Old generated frontend assets are removed only if replaced by new build assets.
- [x] Standalone package serves current provider config UI and backend code.
- [x] Gate check passes: `cd npm_canvas_flow && npm run bundle && node bin/canvas-flow.js doctor --offline`.

**Tests**: none
**Gate**: full
**Commit**: `chore(npm): refresh canvas flow bundle`
**Result**: Complete on 2026-06-13. Ran `npm run bundle`; frontend (vite) + backend (nest) rebuilt and copied into `public/`/`server/` (new assets `index-BUVXJRGV.js` / `index-D-m2588h.css` replacing the stale bundle). `node bin/canvas-flow.js doctor --offline` reported 0 failures and 6 expected local/offline warnings.

---

### T13: Feature validation and traceability closeout

**What**: Validate all provider-config acceptance criteria, update requirement statuses, and record any remaining gaps.
**Where**: `.specs/features/provider-config/spec.md`, `.specs/features/provider-config/tasks.md`, `.specs/project/STATE.md`, relevant README/config docs if validation finds stale references
**Depends on**: T12
**Reuses**: TLC validation checklist, `.specs/codebase/TESTING.md`, acceptance criteria in `spec.md`
**Requirement**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, PROV-08, PROV-09, PROV-10, PROV-11, PROV-12, PROV-13, PROV-14, PROV-15

**Tools**:

- MCP: none
- Skill: `tlc-spec-driven`

**Done when**:

- [x] Every `PROV-*` has a passing automated or documented manual verification.
- [x] `spec.md` traceability statuses are moved to `Verified` only for verified requirements.
- [x] `tasks.md` records completed tasks and gate results.
- [x] `STATE.md` current work points to the next active feature or release checklist.
- [x] Gate check passes: `cd backend && npm test -- --runInBand`; `cd frontend && npm run build`; `cd npm_canvas_flow && node bin/canvas-flow.js doctor --offline`.
- [x] Test count: backend Jest total is recorded and does not decrease from task execution.

**Tests**: unit/manual validation
**Gate**: full
**Commit**: `docs(provider-config): verify provider config spec`
**Result**: Complete on 2026-06-13. All 15 `PROV-*` verified by completed tasks T1–T12 and their gates; `spec.md` traceability statuses moved to `Verified`. Full gate green: backend Jest 10 suites / 147 tests, `frontend npm run build` OK, `doctor --offline` 0 failures / 6 expected local warnings. STATE.md current work advanced past provider-config.

---

## Requirement Coverage

| Requirement | Covered By |
| ----------- | ---------- |
| PROV-01 | T4, T13 |
| PROV-02 | T1, T9, T13 |
| PROV-03 | T1, T13 |
| PROV-04 | T2, T9, T13 |
| PROV-05 | T2, T5, T6, T13 |
| PROV-06 | T1, T9, T13 |
| PROV-07 | T2, T9, T13 |
| PROV-08 | T2, T13 |
| PROV-09 | T3, T5, T6, T13 |
| PROV-10 | T7, T12, T13 |
| PROV-11 | T2, T8, T9, T11, T13 |
| PROV-12 | T4, T10, T13 |
| PROV-13 | T2, T3, T5, T13 |
| PROV-14 | T1, T4, T8, T13 |
| PROV-15 | T1, T6, T10, T13 |

---

## Parallel Execution Map

```text
Phase 1:
  T1 -> T2 -> T3

Phase 2:
  T3 complete, then:
    T4
    T5 [P]
    T6 [P]
    T7 [P]

Phase 3:
  T4 -> T8
  T8 complete, then:
    T9 -> T10
    T11 [P]

Phase 4:
  T5 + T6 + T7 + T10 + T11 -> T12 -> T13
```

**Parallelism constraint**: `[P]` tasks do not share files with each other in the same phase and rely on parallel-safe mocked/unit or build gates from `.specs/codebase/TESTING.md`.

---

## Pre-Approval Checks

### Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | One backend service contract area + co-located tests | OK |
| T2 | One backend service resolution area + co-located tests | OK |
| T3 | One runtime mapper + co-located tests | OK |
| T4 | One controller/API auth behavior + co-located tests | OK |
| T5 | One runner integration area + co-located tests | OK |
| T6 | One RAG integration area + co-located tests | OK |
| T7 | One CLI/env mapping surface | OK |
| T8 | One frontend API/type contract | OK |
| T9 | One modal LLM/scope UX slice | OK |
| T10 | One modal channel/infra UX slice | OK |
| T11 | One Inspector provider status slice | OK |
| T12 | One generated bundle refresh | OK |
| T13 | One validation/traceability closeout | OK |

### Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Start | Match |
| T2 | T1 | T1 -> T2 | Match |
| T3 | T2 | T2 -> T3 | Match |
| T4 | T3 | T3 -> T4 | Match |
| T5 | T3 | T3 -> T5 | Match |
| T6 | T3 | T3 -> T6 | Match |
| T7 | T3 | T3 -> T7 | Match |
| T8 | T4 | T4 -> T8 | Match |
| T9 | T8 | T8 -> T9 | Match |
| T10 | T9 | T9 -> T10 | Match |
| T11 | T8 | T8 -> T11 | Match |
| T12 | T5, T6, T7, T10, T11 | all five -> T12 | Match |
| T13 | T12 | T12 -> T13 | Match |

### Test Co-Location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | NestJS service | unit | unit | OK |
| T2 | NestJS service | unit | unit | OK |
| T3 | NestJS service | unit | unit | OK |
| T4 | NestJS controller | unit | unit | OK |
| T5 | NestJS service | unit | unit | OK |
| T6 | NestJS service | unit | unit | OK |
| T7 | CLI npm | none | none + doctor gate | OK |
| T8 | Frontend API/types | none | none + build gate | OK |
| T9 | Frontend component | none | none + build gate | OK |
| T10 | Frontend component | none | none + build gate | OK |
| T11 | Frontend component | none | none + build gate | OK |
| T12 | NPM generated artifacts | none | none + bundle/doctor gate | OK |
| T13 | Docs/validation | none | unit/manual validation | OK |
