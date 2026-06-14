---
name: discovery
description: The prior intake step for a brand-new (or newly-adopted) AI-First project. Interviews the user about product, users, scope, constraints, AI role, and QA needs BEFORE any spec or code, then drafts the foundational docs (vision, architecture, tech-stack, AI plan) and seeds the SDD engine. Use when starting a project from scratch, bootstrapping this boilerplate, "discovery", "kickoff", "initialize a new product", "ask me before writing docs". Do NOT use for an already-discovered project — go straight to tlc-spec-driven.
license: CC-BY-4.0
metadata:
  version: 1.0.0
  runsBefore: tlc-spec-driven
---

# Discovery — interview before you document

**Goal:** turn a vague idea into confirmed foundational docs, so the SDD loop stands on solid ground.
You are a thinking partner, **not** a form. Ask, challenge vagueness, and **never assume an answer** —
an unexamined assumption here becomes a bug everywhere downstream.

```
INTERVIEW ──► RESEARCH gaps ──► DRAFT docs ──► CONFIRM ──► SEED .specs/
```

Full playbook: `docs/workflows/00-discovery.md`.

## Operating rules

- **One topic at a time.** Don't dump all questions at once; converse.
- **Challenge fuzziness.** "Everyone" is not a user. "Fast" is not a requirement. Push for specifics.
- **Flag, don't fabricate.** If feasibility is unknown, route to the `research` skill — never guess an API or a fact.
- **Confirm before writing "decided".** Drafts are proposals until the user accepts them.
- **AI-First lens.** Even if there's no AI feature yet, decide *where AI could fit* so the architecture stays ready.

## Phase 1 — Interview

Cover these areas. Adapt; skip what's already answered. Capture answers as you go.

### A. Product & value
1. In one sentence, what are you building and for whom?
2. What pain does it remove? Why now?
3. What does success look like for the first usable slice (MVP)?
4. What is explicitly **out** of scope? (anti-scope prevents creep)

### B. Users
5. Who is the *specific* primary user? What's their context when they use it?
6. What's the single most important job they hire this to do?

### C. Constraints
7. Hard constraints: budget, deadline, compliance, platform, team size/skills?
8. Any non-negotiable tech (existing systems, mandated stack)?

### D. AI role (AI-First)
9. Where could AI create differentiated value — now or later? (or "none yet")
10. For each AI candidate: is it core, assistive, or optional? What's the failure tolerance?
11. Any data sensitivity / privacy limits on what can be sent to a model?

### E. Architecture & stack leanings
12. Greenfield or existing code? (existing → run `tlc-spec-driven` "map codebase" after this)
13. Any stack preferences/allergies? What does the team already know well?
14. Expected scale/latency shape (so we don't over- or under-engineer)?

### F. Quality & QA
15. Which user journeys, if broken, mean the product is broken? (these become E2E smoke tests)
16. Does this need browser E2E (Playwright)? Any accessibility/perf bars?

## Phase 2 — Research gaps

For any answer that's "I don't know" but blocks a decision, invoke the **research** skill
(`docs/workflows/02-research.md`). Bring back sourced findings + a recommendation. Do not proceed on a guess.

## Phase 3 — Draft docs

Write the **mandatory foundation set** (as proposals). This exact set is the canonical standard for
**every** project — see `docs/README.md`. None may be skipped; if an answer is unknown, record it as an
explicit assumption inside the doc, never omit the doc.

- `docs/product/vision.md` — problem, user, value prop, anti-scope, success signals, AI role.
- `docs/architecture/overview.md` — context diagram + layer boundaries (tailor to scale).
- `docs/architecture/tech-stack.md` — each choice with a *why*.
- `docs/ai/integration-plan.md` — where AI fits, provider/model leaning, port shape (or "none yet, ready").
- `docs/architecture/decisions/0002-initial-stack.md` — ADR ratifying the stack.

## Phase 4 — Confirm

Present drafts compactly. Ask for corrections. Mark nothing "decided" until the user agrees.
Record open assumptions explicitly as assumptions (never as fact).

## Phase 5 — Seed the SDD engine (hand off to tlc-spec-driven)

This is the **handoff hook**: Discovery's last act is to invoke the `tlc-spec-driven` engine to turn the
confirmed docs into a live `.specs/` workspace. Trigger each command; each links to the engine procedure
it runs.

1. **`Initialize project`** → `.specs/project/PROJECT.md` (mirror `docs/product/vision.md`).
   → [tlc: project-init](../tlc-spec-driven/references/project-init.md)
2. **`Create roadmap`** → `.specs/project/ROADMAP.md` (Milestone 0 = walking skeleton; mirror `docs/product/roadmap.md`).
   → [tlc: roadmap](../tlc-spec-driven/references/roadmap.md)
3. **Existing code?** Also run **`Map codebase`** → 7 brownfield docs in `.specs/codebase/`.
   → [tlc: brownfield-mapping](../tlc-spec-driven/references/brownfield-mapping.md)
4. Confirm `STATE.md` exists for persistent memory.
   → [tlc: state-management](../tlc-spec-driven/references/state-management.md)

After seeding, the project is engine-driven. From here on:
- **Per feature** → the SDD loop, see [01-sdd-loop](../../../docs/workflows/01-sdd-loop.md).
- **Stopping/continuing** → `Pause work` / `Resume work` → [tlc: session-handoff](../tlc-spec-driven/references/session-handoff.md).

## Done when

- [ ] **All 5 foundation docs exist** (`docs/README.md` set) and the user has confirmed them — this is the gate
- [ ] Vision fits one page and the user agrees
- [ ] Architecture boundaries + stack chosen, each with a *why* (ADR-0002 written)
- [ ] AI role decided (even if "none yet"), privacy limits noted
- [ ] Critical journeys identified; Playwright need decided
- [ ] `.specs/` seeded; no open assumption recorded as fact

> After this, every feature flows through the SDD loop (`docs/workflows/01-sdd-loop.md`).
