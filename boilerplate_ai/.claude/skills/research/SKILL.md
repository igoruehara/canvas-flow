---
name: research
description: Verify unknowns before deciding — libraries, APIs, feasibility, AI model/provider choices. Enforces the Knowledge Verification Chain and produces a sourced research note with a recommendation. Use during Discovery or Design when a decision depends on something unverified, for "research X", "is X feasible", "which library/model", "spike". Never fabricates — flags uncertainty instead.
license: CC-BY-4.0
metadata:
  version: 1.0.0
---

# Research — verify, never invent

**Goal:** answer a blocking question with **sourced** facts and a recommendation, or explicitly flag it
as uncertain. A fabricated fact here cascades through design → tasks → code. Uncertainty always beats invention.

Playbook: `docs/workflows/02-research.md`.

## Knowledge Verification Chain (strict order — never skip a step)

```
1. Codebase     → existing code, conventions, prior art (Grep/Glob/read)
2. Project docs → README, docs/, ADRs, .specs/codebase/
3. Context7 MCP → resolve library id, then query current API/patterns
4. Web search   → official docs, reputable/community sources
5. Flag uncertain → "Not certain about X — reasoning is …, verify before relying"
```

- Don't jump to step 5 while 1–4 are available.
- **Never** present step-5 reasoning as fact.
- If nothing is found: say "I couldn't find documentation for this." Do not invent an API/flag/behavior.

## For AI model/provider questions

- Confirm current model ids, context windows, capabilities, and pricing against **live** docs.
- Map task → capability (top model for hard reasoning; faster/cheaper for light, high-volume).
- Note privacy constraints from Discovery (what may/may not be sent to a model).

## Spikes (feasibility)

- A code spike is **throwaway**: quarantine or delete it. The *learning* lives in the note, not the branch.
- Timebox it. If it proves the approach, capture why; if it disproves, capture the blocker.

## Output — a research note

Write to `.specs/research/<topic>.md`:

```markdown
# Research: <topic>
- Question: <what decision this unblocks>
- Findings:
  - <fact> — source: <link / file:line>
  - …
- Options: A / B / C — trade-offs each
- Recommendation: <choice> — because <why>
- Confidence: high | medium | low — what would raise it: <…>
```

## Done when

- [ ] Question answered with sourced facts, or explicitly flagged uncertain
- [ ] Recommendation with trade-offs exists
- [ ] If it changes architecture/stack → an ADR is opened in `docs/architecture/decisions/`
