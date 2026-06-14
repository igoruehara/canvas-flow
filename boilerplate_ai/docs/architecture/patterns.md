# Patterns & Conventions

> The "how code must look" reference. Enforced subset in
> [.claude/rules/coding-standards.mdc](../../.claude/rules/coding-standards.mdc).

## Naming

- Files: `kebab-case`. One primary export per file; file name matches the export's concept.
- Types/classes: `PascalCase`. Functions/vars: `camelCase`. Constants: `UPPER_SNAKE`.
- Ports (interfaces) describe a capability: `AiProvider`, `UserRepository`. Adapters name the tech: `AnthropicAiProvider`, `PostgresUserRepository`.

## Structure

- Group by **feature/domain**, not by technical type. `users/` contains its domain, use-cases, and adapters — not a global `controllers/`, `models/`, `services/`.
- Public surface of a module is its `index` barrel; internals are not imported from outside.

## Functions & control flow

- Prefer pure functions in `domain`. Side effects only in adapters.
- Guard-clause early returns over nested `if`. Keep functions short and single-purpose.
- No "manager"/"util" dumping grounds — name by what it does.

## Errors

- Throw typed domain errors (`NotFoundError`, `ValidationError`), never bare strings.
- Adapters catch transport/SDK errors and rethrow as domain errors.
- Never swallow errors silently; if recovery is intended, comment why.

## Async & data

- `async/await` only; no mixed promise chains.
- Validate external input at the boundary (schema validation). Trust nothing crossing a process edge.
- Immutability by default; copy-on-write for shared structures.

## AI-specific patterns

- All model calls go through the `AiProvider` port. No SDK import outside `infrastructure/ai/`.
- Prompts are versioned artifacts (see [docs/ai/](../ai/)), not inline string literals scattered in code.
- Every AI call is **observable** (model id, token counts, latency, cost) and **evaluable** (deterministic test seam via a fake provider).
- Default to the latest capable model; pin the exact model id in config, not in code.

## Tests

- Test behavior, not implementation. One assertion focus per test.
- Each port has an in-memory fake for unit/use-case tests.
- Critical user journeys get an E2E test (see [qa/e2e/](../../qa/e2e/)).

## Commits

- Conventional Commits 1.0.0. One task = one commit. Subject in imperative mood.
- `feat(scope): …`, `fix(scope): …`, `refactor(scope): …`, `test(scope): …`, `chore(scope): …`.
