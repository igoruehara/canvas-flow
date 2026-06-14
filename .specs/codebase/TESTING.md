# Testing Infrastructure

## Test Frameworks

**Unit/Integration (backend):** Jest 29.7 + ts-jest 29.2 + @nestjs/testing 11.1
**E2E:** não configurado
**Coverage:** Jest `collectCoverageFrom: **/*.(t|j)s` — sem enforcement de threshold
**Frontend:** nenhum framework de teste instalado

## Test Organization

**Location:** Colocated com source — `backend/src/**/*.spec.ts`
**Naming:** `*.spec.ts` (regex Jest: `.*\.spec\.ts$`)
**Root dir Jest:** `backend/src`
**Count:** 8 arquivos de teste

| Spec file | Target |
|-----------|--------|
| `runner/runner-service.spec.ts` | RunnerService (extensive mocks) |
| `runner/runner-controller.spec.ts` | RunnerController |
| `runner/langgraph-runtime.service.spec.ts` | LangGraphRuntimeService |
| `canvas-flow/canvas-flow-service.spec.ts` | CanvasFlowService |
| `rag/rag-service.spec.ts` | RagService |
| `documents/documents-service.spec.ts` | DocumentsService |
| `mcp-oauth/mcp-oauth-service.spec.ts` | McpOAuthService |
| `production-guard.spec.ts` | Production safety checks |

## Testing Patterns

### Unit Tests (backend)

**Approach:** Instanciar services diretamente com dependências mockadas via objetos plain + `jest.fn()`. Sem Testcontainers, sem Mongo real.

**Example pattern** (`runner-service.spec.ts`):
```typescript
const canvasFlowService = { findOne: jest.fn(), ... };
const service = new RunnerService(canvasFlowService as any, ...);
```

**Location:** Same directory as source file.

### Integration Tests

**Approach:** não implementados. Nenhum spec usa supertest contra app NestJS real apesar de supertest estar em devDependencies.

### E2E Tests

**Approach:** ausente (frontend e backend).

## Test Execution

**Commands:**
```bash
cd backend
npm test                    # jest
npm test -- --runInBand     # usado no CI (serial)
npm run build               # nest build (typecheck + compile)
npm run lint                # eslint
npm run audit:prod          # npm audit production deps
```

**Frontend:**
```bash
cd frontend
npm run build               # tsc -b && vite build (único gate de qualidade)
```

**NPM bundle validation:**
```bash
cd npm_canvas_flow
npm run bundle              # build frontend + backend + copy
node bin/canvas-flow.js doctor
```

**CI (`.github/workflows/aws.yml`):**
- `npm ci --legacy-peer-deps`
- `npm test -- --runInBand`
- `npm run audit:prod`
- `npm run build`
- Serverless deploy

## Coverage Targets

**Current:** Sem meta documentada; coverage directory `backend/coverage` configurado mas não enforced no CI.
**Goals:** Não documentados no repositório.
**Enforcement:** Apenas `npm test` no pipeline AWS — falha bloqueia deploy backend.

## Test Coverage Matrix

| Code Layer | Required Test Type | Location Pattern | Run Command |
|------------|-------------------|------------------|-------------|
| NestJS services | unit (mocked) | `backend/src/**/*.spec.ts` | `cd backend && npm test` |
| NestJS controllers | unit (partial) | `backend/src/**/*-controller.spec.ts` | `cd backend && npm test` |
| Production guard | unit | `backend/src/production-guard.spec.ts` | `cd backend && npm test` |
| React components | none | `frontend/src/**` | — |
| CLI npm | none | `npm_canvas_flow/bin/**` | manual: `canvas-flow doctor` |
| API integration | none | — | — |
| E2E browser | none | — | — |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|-----------|----------------|-----------------|----------|
| Backend unit (Jest default) | Yes | All deps mocked; no shared DB | `runner-service.spec.ts` uses `jest.fn()` mocks only |
| Backend unit (CI) | Serial by choice | `--runInBand` in aws.yml | Not required for isolation — CI runs serial for stability |
| Frontend | N/A | No tests | — |

## Gate Check Commands

| Gate Level | When to Use | Command |
|------------|-------------|---------|
| Quick | After backend service changes | `cd backend && npm test` |
| Quick | After frontend UI changes | `cd frontend && npm run build` |
| Full | Before npm publish | `cd npm_canvas_flow && npm run bundle && node bin/canvas-flow.js doctor` |
| Build | Before deploy / PR merge | `cd backend && npm test -- --runInBand && npm run audit:prod && npm run build` |
| CI | Push to dev/hml/prd | GitHub Actions `aws.yml` (full backend pipeline) |

## Gaps (see CONCERNS.md)

- Zero testes no frontend (`App.tsx` ~8.8k linhas sem cobertura)
- Sem testes de integração HTTP (supertest disponível mas não usado)
- CLI `canvas-flow.js` (~1.4k linhas) sem testes automatizados
- `runner-service.ts` (~15k linhas) — spec existe mas cobertura parcial de superfície enorme
