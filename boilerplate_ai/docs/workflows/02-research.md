# Workflow 02 — Research & Discovery Spikes

> Invoked whenever a decision depends on something unknown — a library, an API, a feasibility
> question, an AI capability. Driven by the [Research skill](../../.claude/skills/research/SKILL.md).

## When to invoke

- Discovery hits an unknown that blocks a doc decision.
- Design needs an unfamiliar library/pattern.
- Choosing or bumping an AI model/provider.
- A "will this even work?" feasibility question → a **spike**.

## Knowledge Verification Chain (strict order — never skip)

```
1. Codebase     → existing code, conventions, prior art
2. Project docs → README, docs/, ADRs, .specs/codebase/
3. Context7 MCP → resolve library id, query current API/patterns
4. Web search   → official docs, reputable sources
5. Flag uncertain → "I'm not certain about X — here's my reasoning, verify before relying on it"
```

- Never jump to step 5 if 1–4 are available.
- **Never fabricate.** If you can't verify, say "I don't know" / "couldn't find docs". A made-up API
  poisons design → tasks → implementation in cascade. Uncertainty beats invention, always.

## Output: a research note

```
.specs/research/<topic>.md
- Question: <what we needed to decide>
- Findings: <verified facts + source for each>
- Options: <A / B / C with trade-offs>
- Recommendation: <choice + why>
- Confidence: high | medium | low (what would raise it)
```

A spike that touches code is **throwaway** — delete or quarantine it; the *learning* survives in the note (and an ADR if it changes architecture).

## Done when

- [ ] The blocking question is answered with sourced facts (or explicitly flagged uncertain)
- [ ] A recommendation exists with trade-offs
- [ ] If it changes architecture/stack → an ADR is opened
