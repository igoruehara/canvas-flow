# AI Evaluations

> No AI behavior change ships without evals. Evals are to AI features what unit tests are to logic:
> the gate that lets you change prompts/models with confidence.

## Principles

- **Deterministic seam.** Evals run against the `AiProvider` port; use recorded/golden cases so a run is reproducible.
- **Behavior, not vibes.** Each eval has an explicit pass criterion (exact match, schema-valid, contains-key-facts, or an LLM-as-judge rubric with a threshold).
- **Small & fast first.** A smoke eval set (5–15 cases) runs in CI on every AI change. Larger suites run nightly / pre-release.

## Eval types

| Type | Use when | Pass criterion |
|---|---|---|
| **Golden output** | deterministic-ish tasks (extraction, classification) | exact / schema match |
| **Assertion** | structured output | required fields present & valid |
| **Rubric (LLM-judge)** | open-ended (summaries, rewrites) | judge score ≥ threshold on a written rubric |
| **Regression** | a past failure | the previously-broken case now passes |

## Layout (suggested)

```
qa/evals/
├── cases/<capability>/*.json     # input + expected / rubric
├── run.ts                        # executes cases against the AiProvider port
└── report.md                     # last run: pass rate, regressions, cost
```

## Workflow

1. Add/change a prompt or model → add or update eval cases first.
2. Run the eval set; record pass rate + cost in `report.md`.
3. CI blocks merge if the smoke eval set regresses.
4. A failing real-world case becomes a new regression case (so it can never silently return).

## What to measure

- **Quality:** pass rate per capability.
- **Cost & latency:** tokens and ms per case (trend, not just absolute).
- **Drift:** same cases over time as models change — catch silent regressions when bumping a model id.
