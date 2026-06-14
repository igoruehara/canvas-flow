# Provider Config Design

**Spec**: `.specs/features/provider-config/spec.md`
**Status**: Draft
**Last Updated**: 2026-06-13

---

## Architecture Overview

Provider Config stays as the single resolution layer for all operator-managed provider settings. The design preserves the current modular monolith boundaries: UI reads/writes through REST, the NestJS controller enforces UI auth, `ProviderConfigService` owns persistence/encryption/merge rules, and runtime consumers only ask for effective settings or OpenAI-compatible runtime config.

```text
ProviderConfigModal / Inspector
  -> frontend/src/lib/api.ts
  -> ProviderConfigController
  -> AuthService.assertUiAuth
  -> ProviderConfigService
       -> env defaults from ConfigService
       -> Mongo provider configs: global, agent:{agentId}
       -> AES-GCM secret encryption/masking
       -> effective settings cache
  -> RunnerService / RagService / SqsTransitionService
  -> npm canvas-flow CLI applyEnvironment(config.json -> env)
```

The implementation should avoid adding another provider abstraction. `ProviderConfigService` already exports the two contracts runtime code needs:

- `getEffectiveSettings(agentId?: string): Promise<ProviderSettings>`
- `toOpenAIRuntimeConfig(settings: ProviderSettings, provider?: string): OpenAIRuntimeConfig`

Reads degrade to env settings when Mongo is unavailable. Writes remain Mongo-backed and should fail with a clear `400` when Mongo is disconnected.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --------- | -------- | ---------- |
| `ProviderConfigService` | `backend/src/provider-config/provider-config-service.ts` | Centralize schema defaults, encryption, masking, merge precedence, validation, cache, runtime mapping |
| `ProviderConfigController` | `backend/src/provider-config/provider-config-controller.ts` | Keep all `/api/provider-config*` routes behind `AuthService.assertUiAuth` |
| `ProviderConfigEntity` | `backend/src/provider-config/provider-config-schema.ts` | Persist `{ key, settings, updatedBy }` in `canvas_flow_provider_configs` |
| `RunnerService` provider helpers | `backend/src/runner/runner-service.ts` | Use effective provider settings by `agentId` for LLM client/model resolution |
| `RagService` provider helpers | `backend/src/rag/rag-service.ts` | Refresh effective settings for embeddings, chat, Milvus, Azure Blob/Search |
| `canvasApi` provider methods | `frontend/src/lib/api.ts` | Reuse typed `getProviderConfig`, `updateProviderConfig`, `deleteProviderConfigSection`, `completeWhatsappEmbeddedSignup` |
| `ProviderConfigModal` | `frontend/src/components/ProviderConfigModal.tsx` | Extend existing tabs/sections; preserve secret hints and scoped save/delete behavior |
| `Inspector` provider status | `frontend/src/components/Inspector.tsx` | Reuse configured-provider status and reload on `canvas-flow-provider-config-updated` |
| `applyEnvironment` | `npm_canvas_flow/bin/canvas-flow.js` | Keep standalone `config.json` as env bootstrap source |

### Integration Points

| System | Integration Method |
| ------ | ------------------ |
| MongoDB | `key = global` and `key = agent:{agentId}` documents in `canvas_flow_provider_configs` |
| Env / CLI | `npm_canvas_flow/bin/canvas-flow.js` maps `providers.*` and `runtime.providerCacheMs` to env vars before backend boot |
| Frontend | `ProviderConfigApiResponse` returns safe `settings`, `secretStatus`, and `providerStatus` |
| Runtime | `RunnerService` and `RagService` consume `getEffectiveSettings` and `toOpenAIRuntimeConfig` |
| WhatsApp Meta | `completeWhatsappEmbeddedSignup` calls Graph API, resolves WABA/phone IDs, persists encrypted `whatsapp` settings |
| NPM bundle | `npm run bundle` copies backend/frontend outputs into `npm_canvas_flow/server` and `npm_canvas_flow/public` |

---

## Components

### ProviderConfigService

- **Purpose**: Own the provider settings contract, including defaults, encryption, persistence, effective merge, masking, status reporting, and runtime config mapping.
- **Location**: `backend/src/provider-config/provider-config-service.ts`
- **Interfaces**:
  - `getEnvSettings(): ProviderSettings` - builds base settings from env vars.
  - `getSafeSettings(agentId?: string)` - returns masked settings plus `secretStatus` and `providerStatus`.
  - `updateSettings(patch, updatedBy?, agentId?)` - validates patch, preserves blank secrets, encrypts secrets, clears cache, returns safe settings.
  - `clearSection(section, updatedBy?, agentId?)` - removes one provider section for global or agent scope and restores inheritance.
  - `completeWhatsappEmbeddedSignup(body, updatedBy?, agentId?)` - completes Meta onboarding and persists encrypted WhatsApp settings.
  - `getEffectiveSettings(agentId?: string)` - returns normalized env/global/agent merge with cache TTL.
  - `toOpenAIRuntimeConfig(settings, provider?)` - maps effective settings to the existing OpenAI-compatible runtime shape.
- **Dependencies**: Mongoose model, Nest `ConfigService`, Node `crypto`, Meta Graph API fetch.
- **Reuses**: Existing Nest service pattern and provider-config schema.

### ProviderConfigController

- **Purpose**: Expose authenticated REST endpoints without leaking secrets.
- **Location**: `backend/src/provider-config/provider-config-controller.ts`
- **Interfaces**:
  - `GET /api/provider-config?agentId=...`
  - `PUT /api/provider-config?agentId=...`
  - `DELETE /api/provider-config/:section?agentId=...`
  - `POST /api/provider-config/whatsapp/embedded-signup?agentId=...`
- **Dependencies**: `AuthService.assertUiAuth`, `ProviderConfigService`.
- **Reuses**: Existing UI auth header contract: Bearer JWT, `x-canvas-flow-token`, `x-api-key`.

### Runtime Consumers

- **Purpose**: Make runtime execution use the same effective provider config as the UI shows.
- **Locations**:
  - `backend/src/runner/runner-service.ts`
  - `backend/src/rag/rag-service.ts`
  - `backend/src/queue/sqs-transition-service.ts`
- **Interfaces**:
  - `RunnerService` resolves clients/models with `getEffectiveSettings(agentId)`.
  - `RagService` refreshes settings and passes provider-specific runtime config to embedding/chat helpers.
  - SQS transition code must preserve enough `agentId` / conversation context for runner-side provider resolution.
- **Dependencies**: `ProviderConfigService`, existing OpenAI client factory, existing RAG and runner helpers.
- **Reuses**: Current `createOpenAIClient`, `getOpenAIChatModel`, `getOpenAIEmbeddingModel`, and flow `llmProvider`.

### Frontend Provider UI

- **Purpose**: Let operators configure providers globally or per agent without exposing secrets.
- **Locations**:
  - `frontend/src/components/ProviderConfigModal.tsx`
  - `frontend/src/components/Inspector.tsx`
  - `frontend/src/lib/api.ts`
  - `frontend/src/types/flow.ts`
- **Interfaces**:
  - `ProviderConfigModal({ agentId, flowId, flowName, onClose })`
  - `canvasApi.getProviderConfig({ agentId })`
  - `canvasApi.updateProviderConfig(settings, { agentId })`
  - `canvasApi.deleteProviderConfigSection(section, { agentId })`
  - `canvasApi.completeWhatsappEmbeddedSignup(payload, { agentId })`
- **Dependencies**: Existing auth headers, `CanvasFlowProviderSettings`, browser event `canvas-flow-provider-config-updated`.
- **Reuses**: Current modal shell, secret hints, provider tabs, Inspector `llmProvider` dropdown.

### Standalone CLI Config Bootstrap

- **Purpose**: Treat `~/.canvas-flow/config.json` as env bootstrap for standalone installs.
- **Location**: `npm_canvas_flow/bin/canvas-flow.js`, `npm_canvas_flow/templates/*.json`
- **Interfaces**:
  - `applyEnvironment(config, paths, flags)` maps `providers.*` and `runtime.providerCacheMs` to env vars.
  - `doctor --offline` verifies local config readiness without network checks.
- **Dependencies**: Existing CLI config loader, generated package artifacts.
- **Reuses**: Current template structure and `setEnv` / `setBoolEnv` helpers.

---

## Data Models

### ProviderConfigEntity

```typescript
interface ProviderConfigEntity {
  key: 'global' | `agent:${string}`;
  settings: Record<string, unknown>;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Relationships**: `global` is the shared override document. `agent:{agentId}` stores agent-scoped patches and must not duplicate inherited values unless explicitly saved.

### ProviderSettings

```typescript
interface ProviderSettings {
  llmProvider: 'openai' | 'azure' | 'azure_openai' | 'gemini' | 'claude' | 'grok' | 'bedrock';
  openai: { enabled: boolean; apiKey: string; chatModel: string; embeddingModel: string; ocrModel: string };
  azureOpenai: { enabled: boolean; apiKey: string; endpoint: string; apiVersion: string; chatDeploymentName: string; embeddingDeploymentName: string; ocrDeploymentName: string; embeddingDimensions: number };
  gemini: { enabled: boolean; apiKey: string; chatModel: string };
  claude: { enabled: boolean; apiKey: string; chatModel: string };
  grok: { enabled: boolean; apiKey: string; baseUrl: string; chatModel: string };
  bedrock: { enabled: boolean; apiKey: string; baseUrl: string; region: string; chatModel: string };
  milvus: { address: string; token: string; username: string; password: string; collectionName: string };
  azureBlob: { connectionString: string; containerName: string };
  azureSearch: { endpoint: string; apiKey: string; indexName: string; apiVersion: string };
  mongodb: { connectionString: string; databaseName: string };
  webWidget: { primaryColor: string; accentColor: string; assistantName: string; subtitle: string; welcomeMessage: string; placeholder: string; bubbleLabel: string; avatarText: string; openByDefault: boolean; position: 'right' | 'left' };
  whatsapp: Record<string, unknown>;
}
```

### ProviderConfigApiResponse

```typescript
interface ProviderConfigApiResponse {
  settings: ProviderSettings; // secret fields always blank
  secretStatus: Record<string, boolean>;
  providerStatus?: Record<string, {
    configured: boolean;
    source: 'agent' | 'global' | 'env' | 'none';
    scopeConfigured: boolean;
    inherited: boolean;
  }>;
  onboarding?: Record<string, unknown>;
}
```

---

## Merge And Secret Rules

| Rule | Design |
| ---- | ------ |
| Precedence | `env` base, then global Mongo, then agent Mongo |
| Empty override | Empty string, `null`, and `undefined` do not override inherited values in effective settings |
| Blank secret on PUT | Preserve existing secret in same scope |
| New secret on PUT | Encrypt with AES-256-GCM and store as `enc:<base64url>` |
| GET response | Return secret fields as empty strings and expose only `secretStatus[path]` |
| Cache | Cache effective settings by `global` or `agent:{id}` until TTL, clear all entries on writes |
| Provider fallback | If selected LLM provider has no usable credentials, normalize to first configured provider in fixed order |

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| -------------- | -------- | ----------- |
| Missing/invalid auth on `/api/provider-config*` | `AuthService.assertUiAuth` rejects request | UI/API sees 401/403 |
| Invalid enum values | `BadRequestException` with field-specific message | Modal can show save error |
| Mongo disconnected on read | Fall back to normalized env settings | App can boot and show env-backed status |
| Mongo disconnected on write/delete/onboarding | `BadRequestException` explaining Mongo is unavailable | Operator cannot save until DB is ready |
| Secret decrypt failure after key change | Decrypt returns empty string | Operator must re-save secret; documented gap |
| Meta Graph API failure | `BadRequestException` with Graph message/status | Embedded signup shows actionable failure |
| Runtime provider not configured | Normalize fallback when possible; otherwise existing OpenAI client factory error path applies | Flow test fails clearly instead of returning empty config silently |

---

## Security Considerations

- Never return API keys, tokens, connection strings, or embedded signup app secret in clear text.
- Keep `SECRET_PATHS` as the single backend source for encryption/masking.
- Use `providerStatus` and `secretStatus` for UI hints instead of sending decrypted values.
- Do not log provider secrets in controller, service, CLI, or frontend error messages.
- Treat config.json values as env bootstrap only; Mongo overrides remain encrypted at rest.

---

## Testing Strategy

| Area | Required Checks |
| ---- | --------------- |
| Provider service | Jest unit tests for validation, encryption/masking, blank secret preservation, merge precedence, provider fallback, cache invalidation, delete section |
| Controller auth | Jest controller tests for auth gate and error delegation |
| Runner/RAG | Existing unit tests updated around provider selection and agent-specific settings |
| Frontend | `npm run build` is the current gate; manual UI smoke for modal/Inspector until Vitest/Playwright is introduced |
| CLI/npm | `node bin/canvas-flow.js doctor --offline` plus `npm run bundle` before publish |

---

## Tech Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Provider abstraction | Keep `ProviderConfigService` as the only resolution layer | Avoid another cross-cutting provider facade while code already centralizes the contract |
| Merge precedence | `env -> global -> agent` with empty values ignored | Matches spec and lets `config.json` bootstrap standalone until UI overrides |
| Active provider selection | Keep `FlowConfig.llmProvider` / Inspector ownership | Provider modal stores credentials, not per-flow runtime choice |
| Agent overrides | Store only agent document patches | Reduces duplication and preserves inheritance |
| Generated npm artifacts | Update only via bundle task | Avoid drift between source and published package |
| Frontend tests | Build gate + manual smoke for now | Repo has no frontend test framework yet; adding one is out of scope |

---

## Risks And Mitigations

| Risk | Mitigation |
| ---- | ---------- |
| `RunnerService` and `RagService` are large, fragile files | Keep changes localized to provider helper paths and update existing specs |
| Provider schema touches backend, frontend, CLI, npm bundle | Use `PROV-*` traceability and bundle task after source changes |
| Secret handling regression | Co-locate service tests with every encryption/masking change |
| Config drift between `.env`, `config.json`, and UI | Add CLI/template task and document env mapping as part of `PROV-10` |
| UI regressions without frontend tests | Require frontend build and manual smoke checklist before verification |

