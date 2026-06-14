# Workflow 00 — Discovery (run first)

> The **prior step** before any spec or code. An interview that turns a vague idea into the
> foundational docs, so the SDD loop has something solid to stand on.
> Driven by the [Discovery skill](../../.claude/skills/discovery/SKILL.md).

## When

- Brand-new project (greenfield), or
- An existing project adopting this boilerplate for the first time.

Run it **once** per project. Re-run only on a major pivot.

## Why it exists

Specs written on top of an unexamined idea inherit every hidden assumption. Discovery surfaces those
assumptions **before** they get encoded into requirements, design, and code — where they're 10× costlier to fix.

## The flow

```
Interview ─► Research gaps ─► Draft docs ─► User confirms ─► Seed .specs/
   │             │               │              │                │
 questions   verify unknowns   AI writes    human gate      hand off to
 (gray areas)  (Research)      docs/*         (no silent     tlc-spec-driven
                                              assumptions)
```

1. **Interview** — the agent asks the question set (product, users, scope, constraints, AI role, QA needs). It does **not** assume answers.
2. **Research gaps** — for any unknown that blocks a decision (a library, a feasibility question), invoke the [Research workflow](02-research.md).
3. **Draft docs** — AI writes `docs/product/vision.md`, `docs/architecture/{overview,tech-stack,patterns}.md`, `docs/ai/integration-plan.md`, and ADR-0002 (initial stack).
4. **Confirm** — present drafts; user corrects. Nothing is "decided" until confirmed.
5. **Seed (handoff hook → tlc-spec-driven)** — invoke the engine so `.specs/` mirrors the docs:
   - `Initialize project` → [tlc: project-init](../../.claude/skills/tlc-spec-driven/references/project-init.md)
   - `Create roadmap` → [tlc: roadmap](../../.claude/skills/tlc-spec-driven/references/roadmap.md)
   - existing code? `Map codebase` → [tlc: brownfield-mapping](../../.claude/skills/tlc-spec-driven/references/brownfield-mapping.md)
   - persistent memory via `STATE.md` → [tlc: state-management](../../.claude/skills/tlc-spec-driven/references/state-management.md)

## Output

- `docs/` populated and confirmed
- `docs/architecture/decisions/0002-initial-stack.md`
- `.specs/project/{PROJECT,ROADMAP,STATE}.md` seeded
- Roadmap with a Milestone 0 walking skeleton

## Done when

- [ ] Vision fits one page and the user agrees with it
- [ ] Architecture boundaries + tech stack chosen, each with a *why*
- [ ] AI role decided (even if "none yet")
- [ ] QA/E2E expectation set (does this need Playwright? which journeys are critical?)
- [ ] No open assumption marked as fact
