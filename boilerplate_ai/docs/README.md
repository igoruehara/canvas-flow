# docs/ — Foundation manifest

This file declares the **canonical documentation set**: the docs that every project built from this
boilerplate **must** have before the SDD loop starts. The [Discovery skill](../.claude/skills/discovery/SKILL.md)
produces them; its completion gate checks that all five exist.

## Required foundation docs (always — non-negotiable)

| Doc | Captures (from what) |
|---|---|
| [product/vision.md](product/vision.md) | problem, target user, value prop, anti-scope, AI role |
| [architecture/overview.md](architecture/overview.md) | layer boundaries + context diagram (tailored to scale) |
| [architecture/tech-stack.md](architecture/tech-stack.md) | each stack choice **with the why** |
| [ai/integration-plan.md](ai/integration-plan.md) | where AI fits — or "none yet, but architecture is ready" |
| [architecture/decisions/0002-initial-stack.md](architecture/decisions/) | ADR ratifying the initial stack |

> A project is **not** ready to leave Discovery until all five exist and the user has confirmed them.
> Nothing here is "decided" until confirmed — unknowns are recorded as explicit assumptions, never as fact.

## Grows with the project (added as the work demands)

| Doc | When it appears |
|---|---|
| [product/roadmap.md](product/roadmap.md) | as soon as there's more than one feature to order |
| [ai/evaluations.md](ai/evaluations.md) | the moment the first AI behavior ships |
| [architecture/patterns.md](architecture/patterns.md) | refined as conventions solidify |
| `architecture/decisions/NNNN-*.md` | one ADR per non-trivial decision, forever |

## Relationship to the other layers

- The **rules** (`.claude/rules/*.mdc`) enforce what these docs describe — docs are the *why*, rules are the *what*.
- The **SDD engine** (`tlc-spec-driven`) consumes these docs and writes `.specs/` on top of them.
- The **orchestrator** ([AGENTS.md](../AGENTS.md)) points every agent here first.
