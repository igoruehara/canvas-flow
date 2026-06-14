# State

**Last Updated:** 2026-06-13
**Current Work:** provider-config feature COMPLETE (T1–T13 verified). Next: recreate operational docs (release checklist / production gates) in `.specs/` and fix broken `docs/PRODUCTION_READINESS.md` references.

---

## Recent Decisions (Last 60 days)

### AD-001: Migração de docs/sdd para estrutura TLC .specs/ (2026-06-13)

**Decision:** Adotar TLC Spec-Driven com documentação persistente em `.specs/` (codebase mapping + project vision + state), substituindo a pasta `docs/sdd/` removida.
**Reason:** Brownfield precisa de memória entre sessões, rastreabilidade de decisões e specs executáveis sem depender de docs soltas ou desatualizadas.
**Trade-off:** Período de transição com links quebrados no README e ausência temporária de checklist operacional formal.
**Impact:** Novas features e releases seguem fluxo Specify → Design → Tasks → Execute; documentação operacional será recriada em `.specs/` em vez de `docs/`.

---

## Active Blockers

_Nenhum bloqueador ativo registrado._

---

## Lessons Learned

### L-001: Remoção de docs/ deixou referências órfãs (2026-06-13)

**Context:** Pasta `docs/` (incluindo `docs/sdd/` e `docs/PRODUCTION_READINESS.md`) foi removida durante reorganização do repositório.
**Problem:** `README.md` (e `backend/README.md`, `website/docs.html`) ainda referenciam `docs/PRODUCTION_READINESS.md`, que não existe mais — onboarding e gates de produção ficam sem fonte canônica.
**Solution:** Mapeamento brownfield em `.specs/codebase/`; inicialização do projeto TLC; todo explícito para recriar documentação operacional.
**Prevents:** Publicar releases ou onboardar clientes sem checklist; adicionar novos links para `docs/` sem verificar existência do arquivo.

---

## Quick Tasks Completed

| #   | Description                              | Date       | Commit | Status  |
| --- | ---------------------------------------- | ---------- | ------ | ------- |
| 001 | Brownfield codebase mapping (.specs/codebase/) | 2026-06-13 | —      | ✅ Done |
| 002 | TLC Initialize project (PROJECT.md)      | 2026-06-13 | —      | ✅ Done |
| 003 | TLC Create roadmap (ROADMAP.md)          | 2026-06-13 | —      | ✅ Done |
| 004 | TLC Specify feature provider-config      | 2026-06-13 | —      | ✅ Done |
| 005 | TLC Design feature provider-config       | 2026-06-13 | —      | ✅ Done |
| 006 | TLC Tasks feature provider-config        | 2026-06-13 | —      | ✅ Done |
| 007 | TLC Execute provider-config T1–T13       | 2026-06-13 | —      | ✅ Done |

---

## Deferred Ideas

- [ ] Refatorar `runner-service.ts` em step executors modulares — Captured during: brownfield mapping
- [ ] Automatizar `npm run bundle` no CI antes de publish npm — Captured during: concerns audit
- [ ] Suite de testes frontend (Vitest/Playwright) — Captured during: concerns audit
- [ ] `doctor --strict` falhar se instância pública sem login — Captured during: security review

---

## Todos

- [ ] Recriar documentação operacional (release checklist / gates de produção) em `.specs/`
- [ ] Corrigir referências quebradas a `docs/PRODUCTION_READINESS.md` no README e website
- [x] Executar provider-config T1 → T13 conforme `.specs/features/provider-config/tasks.md`
