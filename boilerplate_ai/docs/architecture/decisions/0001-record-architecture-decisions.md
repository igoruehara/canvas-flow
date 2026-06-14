# 1. Record architecture decisions

- **Status:** Accepted
- **Date:** <YYYY-MM-DD>

## Context

We need a durable, low-ceremony way to capture *why* significant choices were made, so that
agents and humans joining later don't re-litigate settled decisions or silently drift from them.

## Decision

We use **Architecture Decision Records (ADRs)**, one Markdown file per decision in
`docs/architecture/decisions/`, numbered sequentially (`NNNN-title.md`). Each ADR follows the
template below. A decision is only "real" once its ADR is Accepted.

## Consequences

- Every non-trivial architectural or stack choice (see [tech-stack.md](../tech-stack.md)) gets an ADR.
- ADRs are immutable once Accepted; to change a decision, write a new ADR that **supersedes** it.
- The orchestrator ([AGENTS.md](../../../AGENTS.md)) points here for "why was this done?".

---

## ADR template (copy for new decisions)

```markdown
# N. <short title>

- Status: Proposed | Accepted | Superseded by ADR-XXXX
- Date: <YYYY-MM-DD>

## Context
<forces at play; what makes this non-obvious>

## Decision
<the choice, stated plainly>

## Consequences
<what becomes easier, what becomes harder, what we now must do>

## Alternatives considered
<option → why rejected>
```
