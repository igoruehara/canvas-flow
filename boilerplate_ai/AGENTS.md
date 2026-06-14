# AGENTS.md — Orchestrator

> Single entry point for any AI agent (Claude Code, Cursor, Copilot…) working in this repo.
> Read this first. It does not contain the rules — it tells you **where they live** and **in what order to apply them**.

## ⛳ Start here — the first move (do this before anything else)

**If the foundation docs don't exist yet, your FIRST action is the `discovery` skill — before any spec, design, or code.** No exceptions. Discovery interviews the user, then writes the five mandatory foundation docs and seeds `.specs/`. The SDD loop does not begin until Discovery passes its gate.

```
new / freshly-adopted repo ──► run `discovery` FIRST ──► foundation docs exist ──► then the SDD loop (tlc-spec-driven)
```

**How to tell which state you're in:** if [docs/product/vision.md](docs/product/vision.md) is missing or still contains `<placeholder>` text, Discovery has **not** run — run it now. Otherwise the project is discovered; proceed to the SDD loop below.

## What this project is

<!-- Filled by the Discovery skill. Keep to 3-5 lines. -->
- **Product:** _<one sentence: what it does and for whom>_
- **Stage:** _<idea | prototype | MVP | production>_
- **AI-First:** this project treats AI as a first-class capability. Even before AI features exist, decisions are made so they can be added without rework. See [docs/ai/integration-plan.md](docs/ai/integration-plan.md).

## How to work here (read in this order)

0. **Discovery (first run only).** New or freshly-adopted project? Run the `discovery` skill **before** everything below — see [docs/workflows/00-discovery.md](docs/workflows/00-discovery.md). It produces the foundation docs and seeds `.specs/`. Skip only if those docs already exist.
1. **Process** — how we go from idea to merged code: [docs/workflows/01-sdd-loop.md](docs/workflows/01-sdd-loop.md). The SDD loop (Specify → Design → Tasks → Execute) is driven by the `tlc-spec-driven` skill.
2. **Architecture** — boundaries you must not cross: [docs/architecture/overview.md](docs/architecture/overview.md).
3. **Patterns & conventions** — how code must look: [docs/architecture/patterns.md](docs/architecture/patterns.md).
4. **Rules (enforced)** — machine-readable guardrails in [.claude/rules/](.claude/rules/). These are the source of truth; the docs are the rationale.

## Canonical foundation docs (every project has these)

Five docs are **mandatory** before the SDD loop starts — produced and gated by Discovery. The
manifest is [docs/README.md](docs/README.md):

1. [docs/product/vision.md](docs/product/vision.md)
2. [docs/architecture/overview.md](docs/architecture/overview.md)
3. [docs/architecture/tech-stack.md](docs/architecture/tech-stack.md)
4. [docs/ai/integration-plan.md](docs/ai/integration-plan.md)
5. [docs/architecture/decisions/0002-initial-stack.md](docs/architecture/decisions/) (ADR)

## Map of the repo

| You want to… | Go to |
|---|---|
| Start a brand-new project from scratch | Run the **Discovery** skill → [.claude/skills/discovery/SKILL.md](.claude/skills/discovery/SKILL.md) |
| Understand the product vision / roadmap | [docs/product/](docs/product/) |
| Understand the architecture | [docs/architecture/](docs/architecture/) |
| Know why a decision was made | [docs/architecture/decisions/](docs/architecture/decisions/) (ADRs) |
| Plan or build a feature (SDD) | `tlc-spec-driven` skill → produces `.specs/` |
| Research an unknown library/approach | **Research** skill → [.claude/skills/research/SKILL.md](.claude/skills/research/SKILL.md) |
| Add E2E / QA coverage | **QA-E2E** skill → [.claude/skills/qa-e2e/SKILL.md](.claude/skills/qa-e2e/SKILL.md) + [qa/e2e/](qa/e2e/) |
| Plan AI features / evals | [docs/ai/](docs/ai/) |

## Rules of engagement (non-negotiable)

- **Spec before code.** No non-trivial change without a spec/task. Trivial fixes use `tlc-spec-driven` Quick Mode.
- **Respect boundaries.** Never import across the layers forbidden in [.claude/rules/architecture.mdc](.claude/rules/architecture.mdc).
- **Verify, then commit.** One task = one atomic commit (Conventional Commits). Tests/gate must pass first.
- **Never fabricate.** Follow the Knowledge Verification Chain (codebase → docs → Context7 MCP → web → flag uncertain). If you can't verify, say so.
- **AI changes need evals.** Any AI-facing behavior change must update [docs/ai/evaluations.md](docs/ai/evaluations.md).

## Conventions index

- Commits: Conventional Commits 1.0.0
- Branches: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`
- Specs output: `.specs/` (created by `tlc-spec-driven`)
- ADRs: `docs/architecture/decisions/NNNN-title.md`
