# Workflow 01 — The SDD Loop

> The core build cycle, driven by the `tlc-spec-driven` skill. Runs once **per feature** after Discovery.
> Depth auto-sizes to complexity — apply only what the scope needs.

## Before the loop — the seed (handoff from Discovery)

The engine is first invoked **at the tail of Discovery** ([00-discovery.md](00-discovery.md) Phase 5), not by you.
It seeds the project once:

```
Discovery confirms docs ──► tlc seeds .specs/ :
    Initialize project  → .specs/project/PROJECT.md   → tlc: project-init
    Create roadmap      → .specs/project/ROADMAP.md   → tlc: roadmap
    (existing code) Map codebase → .specs/codebase/   → tlc: brownfield-mapping
```

Hooks: [project-init](../../.claude/skills/tlc-spec-driven/references/project-init.md) ·
[roadmap](../../.claude/skills/tlc-spec-driven/references/roadmap.md) ·
[brownfield-mapping](../../.claude/skills/tlc-spec-driven/references/brownfield-mapping.md)

**How to tell seeding is done:** `.specs/project/ROADMAP.md` exists → pull the next feature and start the loop below.

## The loop — per feature (you trigger this)

```
SPECIFY ──► DESIGN ──► TASKS ──► EXECUTE ──► VALIDATE
required    optional   optional  required    (user-facing)
```

## Auto-sizing

| Scope | Specify | Design | Tasks | Execute |
|---|---|---|---|---|
| Small (≤3 files) | Quick mode — skip the pipeline | — | — | implement + verify |
| Medium | brief spec | inline | inline | per task |
| Large | full spec + IDs | architecture | full breakdown | per task |
| Complex | spec + discuss gray areas | research + architecture | breakdown + parallel | + interactive UAT |

## Steps

1. **Specify** — `"Specify feature <name>"` → `.specs/features/<name>/spec.md` with traceable IDs (`FEAT-01`). Ambiguity auto-triggers a *discuss* → `context.md`.
2. **Design** *(when needed)* — `"Design the feature"` → `design.md`. Unknowns go through the [Research workflow](02-research.md). AI features must align with [docs/ai/integration-plan.md](../ai/integration-plan.md).
3. **Tasks** *(when needed)* — `"Break into tasks"` → `tasks.md`, atomic, each with *Done when*.
4. **Execute** — `"Implement T1"`… → `Plan → Implement → Verify → Commit` per task. One atomic commit each.
5. **Validate** — `"Validate"` → acceptance criteria + [QA/E2E](03-qa-e2e.md) for critical journeys.

## Guardrails

- **Spec before code.** Even Quick Mode produces a one-line task + verify step.
- **No scope creep.** Out-of-task ideas go to `STATE.md` → Deferred (and roadmap parking lot).
- **Respect architecture.** [.claude/rules/architecture.mdc](../../.claude/rules/architecture.mdc) is non-negotiable.
- **AI changes ship with evals.** See [docs/ai/evaluations.md](../ai/evaluations.md).

## Session hygiene

- `"Pause work"` before stopping → `HANDOFF.md`.
- `"Resume work"` → reload state and continue exactly where you left off.
- Hook: [tlc: session-handoff](../../.claude/skills/tlc-spec-driven/references/session-handoff.md) · [tlc: state-management](../../.claude/skills/tlc-spec-driven/references/state-management.md)
