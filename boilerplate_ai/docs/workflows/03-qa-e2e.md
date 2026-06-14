# Workflow 03 — QA & E2E

> How we prove a feature works from the user's seat, not just in unit tests.
> Driven by the [QA-E2E skill](../../.claude/skills/qa-e2e/SKILL.md). Setup lives in [qa/e2e/](../../qa/e2e/).

## The testing pyramid (what goes where)

```
        ╱ E2E ╲          few — critical user journeys (Playwright)
      ╱─────────╲
    ╱ integration ╲      some — adapters against real boundaries
  ╱─────────────────╲
 ╱   unit / use-case  ╲  many — fast, deterministic, fakes for ports
```

Don't invert the pyramid. E2E is expensive — reserve it for **journeys that, if broken, mean the product is broken.**

## When to add an E2E test

- A new user-facing critical path (login, checkout, the core action).
- A bug that escaped to a user (add a regression E2E so it can't return).
- Before a release: the smoke suite must be green.

## The flow

1. **Identify journeys** — from the spec's acceptance criteria, pick the must-not-break paths.
2. **Write the smoke test** — one happy path per journey in `qa/e2e/tests/`.
3. **Add edge cases** — only the high-value ones (auth failure, empty state, error path).
4. **Wire the gate** — E2E smoke runs in CI; merge blocked on red.

## Conventions

- One spec file per journey: `tests/<journey>.spec.ts`.
- Use role/text selectors (`getByRole`, `getByText`), not brittle CSS/XPath.
- Tests are independent and idempotent — no shared mutable state, no order dependence.
- Keep the **smoke** suite fast (< a couple of minutes); push exhaustive coverage to a nightly run.

## AI features in E2E

- Stub the `AiProvider` with the **fake adapter** for deterministic E2E (don't hit a live model in CI).
- Quality of the AI output itself is covered by [evals](../ai/evaluations.md), not E2E. E2E checks that the
  *wiring* (UI → use-case → AI port → render) works.

## Done when

- [ ] Each critical journey from the spec has a passing smoke test
- [ ] Regression tests exist for any user-visible bug fixed
- [ ] CI gate blocks merge on E2E failure
