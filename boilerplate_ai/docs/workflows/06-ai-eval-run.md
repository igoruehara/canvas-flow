# Workflow 06 — AI Eval Run

> The gate that lets you change a prompt or model with confidence. Evals are to AI features what unit
> tests are to logic — no AI behavior change ships without a green eval run.

## When this runs

- Any time a **prompt** or **model id** changes.
- When **bumping a provider/model** (catch silent drift).
- Before a release that includes an AI-facing change.
- A real-world AI failure → add it as a regression case, then run.

## The flow

```
change prompt/model ──► add/update eval cases ──► run suite ──► read report ──► gate merge
                              │                       │             │
                        cases live with         against the    pass rate, cost,
                        the capability          fake provider  regressions
                        (golden / rubric)       (deterministic)
```

## Steps + hooks

1. **Add/update cases first** for the capability you're changing. → [evaluations.md](../ai/evaluations.md)
2. **Run** the suite against the `AiProvider` **fake** adapter (deterministic, no live model in CI).
   → [ai-guardrails rule](../../.claude/rules/ai-guardrails.mdc)
3. **Read the report** — pass rate per capability, cost/latency trend, any regressions.
4. **Gate the merge** — the smoke eval set must not regress. → [ai-guardrails rule](../../.claude/rules/ai-guardrails.mdc)
5. A failing real case → freeze it as a **regression** case so it can never silently return.

## Hand-offs

- **In:** a prompt/model change from [Design](01-sdd-loop.md) or a provider bump from [08-dependency-update] *(when added)*.
- **Out:** a green eval report + updated regression set.
- **Next:** the change is cleared to continue Execute / Release.

## Gates / Done when

- [ ] Eval cases exist for the changed capability
- [ ] Suite runs against the fake provider (no live model in CI)
- [ ] Smoke eval set does not regress vs. baseline
- [ ] Any real-world failure captured as a regression case
- [ ] Cost/latency trend reviewed (not just pass/fail)

## Anti-patterns

- **"Looks good to me" instead of a criterion.** Every case needs an explicit pass test (match / schema / rubric threshold).
- **Hitting a live model in CI.** Non-deterministic and costly — stub via the fake adapter; quality lives in evals, not E2E.
- **Bumping a model without re-running evals.** That's how silent regressions ship.
- **Letting the suite grow unbounded.** Keep a fast *smoke* set for CI; push exhaustive cases to a nightly run.
