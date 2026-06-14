---
name: qa-e2e
description: Plan and write end-to-end / QA coverage for critical user journeys with Playwright. Use after a feature's Execute phase, for "add E2E", "write a Playwright test", "QA this flow", "smoke test", or before a release. Keeps the test pyramid honest — E2E only for must-not-break journeys; stubs AI via the fake provider for determinism.
license: CC-BY-4.0
metadata:
  version: 1.0.0
---

# QA-E2E — prove the journey, not the implementation

**Goal:** verify the product works from the user's seat for the paths that, if broken, mean the product
is broken. Keep E2E few and fast; push exhaustive coverage down the pyramid.

Playbook: `docs/workflows/03-qa-e2e.md`. Setup: `qa/e2e/`.

## When to use

- A new user-facing critical path shipped (Execute done) → add a smoke test.
- A user-visible bug was fixed → add a regression E2E.
- Pre-release → the smoke suite must be green.

## Procedure

1. **Pick journeys.** From the feature's acceptance criteria (spec ids), select the must-not-break paths. Resist testing everything.
2. **Write the happy path.** One spec per journey in `qa/e2e/tests/<journey>.spec.ts`. Use `getByRole`/`getByText`.
3. **Add high-value edges only.** Auth failure, empty state, the one error path users actually hit.
4. **Keep it deterministic.** Independent, idempotent tests. No shared mutable state, no order dependence.
5. **Stub AI.** Wire the **fake `AiProvider`** so CI never calls a live model. AI output quality is an
   eval concern (`docs/ai/evaluations.md`), not E2E — here you verify the *wiring* (UI → use-case → AI port → render).
6. **Wire the gate.** Ensure the smoke suite runs in CI and blocks merge on red.

## Conventions

- One journey per spec file; descriptive `test()` names that read as user intent.
- Selectors by role/text/label, never brittle CSS/XPath.
- Smoke suite stays under a couple of minutes; exhaustive cases go to a nightly run.

## Done when

- [ ] Each critical journey from the spec has a passing smoke test
- [ ] Regression tests cover any user-visible bug fixed
- [ ] AI calls are stubbed with the fake provider in E2E
- [ ] CI gate blocks merge on E2E failure
