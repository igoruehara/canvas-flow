# Tech Stack

> Filled/confirmed by the Discovery skill. Each choice records **why** + the ADR that ratified it.
> Keep it honest: list only what's actually decided.

## Runtime & language

| Concern | Choice | Why | ADR |
|---|---|---|---|
| Language | _<e.g. TypeScript>_ | _<type safety, ecosystem>_ | _ADR-000X_ |
| Runtime | _<e.g. Node 22>_ | — | — |
| Package manager | _<npm / pnpm>_ | — | — |

## Application

| Concern | Choice | Why |
|---|---|---|
| Framework | _<e.g. none / Next / Express / Fastify>_ | — |
| Data store | _<e.g. Postgres / SQLite / none yet>_ | — |
| Validation | _<e.g. zod>_ | boundary validation |

## AI layer (AI-First)

| Concern | Choice | Why |
|---|---|---|
| Provider (default) | **Anthropic Claude** | latest capable models; tool use, MCP, caching |
| Model (default) | _pin exact id in config, e.g. `claude-opus-4-8` for hard tasks, a faster model for light ones_ | match capability to task |
| SDK location | `infrastructure/ai/` only | provider stays swappable (port/adapter) |
| Eval harness | see [docs/ai/evaluations.md](../ai/evaluations.md) | no AI change ships without evals |

> Always confirm current model ids / pricing against live docs — never hardcode from memory.

## Quality & tooling

| Concern | Choice |
|---|---|
| Unit tests | _<vitest / jest>_ |
| E2E | **Playwright** → [qa/e2e/](../../qa/e2e/) |
| Lint / format | _<eslint + prettier / biome>_ |
| CI gate | lint + unit + E2E smoke must pass before merge |

## Decision log

All non-trivial choices above must have an ADR in [decisions/](decisions/).
