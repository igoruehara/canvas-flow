# Code Conventions

Convenções observadas no código existente (não prescrições ideais).

## Naming Conventions

**Files (backend):**
- Kebab-case com sufixo de papel: `*-module.ts`, `*-service.ts`, `*-controller.ts`, `*-schema.ts`, `*-connect-provider.ts`, `*-constants-model.ts`
- DTOs em subpasta `dto/`: `create-canvas-flow.dto.ts`
- Specs colocados junto ao source: `runner-service.spec.ts`
- Examples: `canvas-flow-service.ts`, `provider-config-connect-provider.ts`, `queue-message-dedupe-schema.ts`

**Files (frontend):**
- PascalCase para componentes React: `ProviderConfigModal.tsx`, `CanvasStepNode.tsx`
- camelCase para libs: `api.ts`, `defaultFlow.ts`, `flowTemplates.ts`
- Types centralizados: `types/flow.ts`

**Classes/Services:**
- PascalCase + sufixo NestJS: `CanvasFlowService`, `SqsTransitionService`, `LangGraphRuntimeService`

**Functions/Methods:**
- camelCase: `assertUiAuth`, `getEffectiveSettings`, `createDefaultFlow`, `resolveFlowVersion`
- Prefixos privados com `private` no TS, não underscore

**Constants:**
- UPPER_SNAKE para tokens de injeção e collection names: `STRING_URL_DATABASE_CONNECTION`, `MODEL_NAME`, `COLLECTION_NAME`
- Definidos em `*-constants-model.ts` ou `constants-global.ts`

**Mongo collections:**
- snake_case com prefixo: `canvas_flows`, `canvas_langgraph_checkpoints`

## Code Organization

**Import ordering (backend):**
1. NestJS / Node built-ins
2. Third-party (`mongoose`, `openai`, AWS SDK)
3. Relative imports de outros módulos (`../auth/auth-service`)

Example from `canvas-flow-controller.ts`:
```typescript
import { Body, Controller, ... } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth-service';
import { CanvasFlowService } from './canvas-flow-service';
```

**NestJS module structure (consistent across features):**
```
feature/
├── feature-module.ts
├── feature-controller.ts
├── feature-service.ts
├── feature-schema.ts
├── feature-constants-model.ts
├── feature-connect-provider.ts
└── dto/
```

**File structure within services:**
- Types/interfaces no topo do arquivo
- Injectable class com constructor injection
- Métodos públicos antes de privados (nem sempre rigoroso em arquivos grandes)

## Type Safety

**Approach:** TypeScript strict em backend; frontend usa types explícitos em `types/flow.ts` mas também `any` em payloads dinâmicos de webhook/flow config.

**DTOs:** class-validator decorators em DTOs NestJS para endpoints formais; muitos endpoints de agente usam `@Body() body: any`.

**Flow types:** `StepType`, `FlowConfig`, `FlowStep` definidos no frontend e espelhados implicitamente no runner backend via interfaces locais.

## Error Handling

**Pattern:** NestJS `HttpException` / `HttpStatus` para erros HTTP; `UnauthorizedException` em auth.

Example from `auth-service.ts`:
```typescript
throw new UnauthorizedException('Invalid credentials');
```

**Production guard:** Falhas de config em produção via `assertProductionSafety()` — log + throw se `CANVAS_FLOW_STRICT_PRODUCTION=true`.

**Observability:** `logEvent()` e `getErrorDetails()` em `observability/observability.ts` para eventos estruturados.

## Auth Headers (consistent API contract)

Endpoints UI aceitam combinação de:
- `Authorization: Bearer <jwt>`
- `x-canvas-flow-token`
- `x-api-key`

Resolvido por `AuthService.assertUiAuth()` em controllers.

## Comments/Documentation

**Style:** Poucos comentários inline; Swagger `@ApiTags` nos controllers. Lógica complexa de fluxo/RAG sem documentação extensa no código.

**Language:** Código e identificadores em inglês; strings de UI e prompts RAG frequentemente em português.

## Git / Commits

Repositório usa Conventional Commits em PRs; pacote npm versionado em `npm_canvas_flow/package.json` (atual: 0.1.13).

## Config Conventions

**Env vars:** UPPER_SNAKE, prefixo `CANVAS_FLOW_` para settings específicos do produto.
**Standalone config.json:** camelCase aninhado (`database.mongoUrl`, `auth.apiToken`, `providers.openai.apiKey`).
