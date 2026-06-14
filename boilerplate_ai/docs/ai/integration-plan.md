# AI Integration Plan

> For an **AI-First project that has no AI in it yet**: this is where you decide *how* AI will
> enter the system before you write a single prompt — so it lands as a clean port, not a hack.

## 1. Where AI fits (and where it must not)

List each candidate AI capability and classify it. Do this **before** building.

| Capability | Value | AI is… | Failure tolerance |
|---|---|---|---|
| _e.g. summarize user notes_ | _saves time_ | core | medium (human can edit) |
| _e.g. classify support tickets_ | _routing_ | assistive | low (needs guardrail) |
| _e.g. autocomplete_ | _nice-to-have_ | optional | high |

> Rule: AI is a **port** in `application`, implemented by adapters in `infrastructure/ai/`.
> Never call a model SDK from `ui` or `domain`. See [architecture/overview.md](../architecture/overview.md).

## 2. Provider & models

- **Default provider:** Anthropic Claude (tool use, MCP, prompt caching, strong reasoning).
- **Model policy:** pin exact model ids in config, not code. Match capability to task — a top model
  (e.g. `claude-opus-4-8`) for hard reasoning; a faster/cheaper model for light, high-volume calls.
- **Always verify** current model ids, context windows, and pricing against live docs before committing — do not trust memory.

## 3. The port contract

```
application/ports/ai-provider.ts
  interface AiProvider {
    complete(input): Promise<Result>   // text / structured output
    // streaming, tool-use, embeddings as needed
  }
infrastructure/ai/anthropic.adapter.ts   // real
infrastructure/ai/fake.adapter.ts        // deterministic — used by tests & evals
```

The **fake adapter** is mandatory: it makes use-cases testable without network and is the seam for evals.

## 4. Prompt management

- Prompts are **versioned artifacts**, not inline literals. Store with the capability they serve.
- Each prompt records: purpose, input contract, model, expected output shape, and a few golden examples.
- Changing a prompt = changing behavior → must update [evaluations.md](evaluations.md) and ship with passing evals.

## 5. Cost, latency, safety

- Log model id, token counts, latency, and estimated cost on every call (observability at the adapter).
- Set timeouts and a fallback path for every AI call (degrade gracefully — never hard-fail the UX on a model hiccup).
- Validate/parse model output at the boundary; treat it as untrusted input.

## 6. Rollout gate

A capability moves from "planned" → "shipped" only when: port + fake exist, evals exist and pass,
observability is wired, and a fallback is defined.
