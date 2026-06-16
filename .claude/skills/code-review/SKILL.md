---
name: code-review
description: Revisão de pull request do Canvas Flow contra o Definition of Done (DoD) da tarefa. Verifica o diff quanto a bugs, segurança e consistência com os critérios de aceite em `.specs/features/<feature>/spec.md`, os gates do `AGENTS.md`, as convenções em `.specs/codebase/` e a documentação em `docs/`. Use ao revisar PRs ou ao aplicar correções pedidas via `/fix`.
---

# Code Review — Canvas Flow

Você revisa pull requests deste monorepo: **backend** (NestJS, `backend/src/`), **frontend** (Vite/React, `frontend/src/`) e **npm_canvas_flow** (bundle/CLI). O objetivo é checar se o diff cumpre o **Definition of Done (DoD)** da tarefa e está consistente com as regras do repositório, e **comentar os pontos** que precisam de atenção.

## 1. Descubra o contexto da tarefa (faça SEMPRE antes de revisar)

1. Leia `AGENTS.md` — modo de operação TLC, gates do repositório e regras de execução.
2. Identifique a feature/tarefa do PR pelo **título do PR, nome da branch, descrição e arquivos tocados** no diff.
3. Localize a spec da feature em `.specs/features/<feature>/`:
   - `spec.md` → **Acceptance Criteria** (formato `WHEN ... THEN sistema SHALL ...`) por User Story. **Isso é o DoD.**
   - `tasks.md` → tarefas (`T1..Tn`) com **What / Where** e **gates** de cada uma.
   - `design.md` → decisões de design que o código deve respeitar.
4. Leia o que for relevante de `.specs/codebase/`:
   - `CONVENTIONS.md` → padrões obrigatórios do código.
   - `CONCERNS.md` → áreas frágeis e armadilhas conhecidas.
   - `TESTING.md` → matriz de testes e gates de verificação.
5. Leia a documentação em `docs/` relacionada ao que mudou.

Se **não** encontrar `.specs/features/<feature>/` correspondente, diga isso explicitamente no resumo e revise pelos princípios gerais + `AGENTS.md` + `.specs/codebase/`.

## 2. Revise o diff contra o DoD

Para cada trecho alterado, verifique nesta ordem de prioridade:

1. **DoD / Acceptance Criteria** — o diff cumpre os critérios `WHEN/THEN/SHALL` da user story correspondente? Aponte critérios **não atendidos** ou **parcialmente atendidos**, citando o critério em `spec.md`.
2. **Bugs e regressões** — lógica incorreta, casos de borda, contratos de API quebrados.
3. **Segurança** — segredos vazados, criptografia/máscara de credenciais (este repo cifra segredos com `enc:` AES-256-GCM e nunca retorna em texto claro), injeção, autorização.
4. **Convenções e gates** — `.specs/codebase/CONVENTIONS.md` e regras do `AGENTS.md`. Em especial: **não** editar artefatos gerados (`npm_canvas_flow/server/**`, `npm_canvas_flow/public/**`) a menos que a tarefa seja explicitamente sobre o bundle.
5. **Áreas frágeis** — se o PR toca algo listado em `.specs/codebase/CONCERNS.md`, cobre o cuidado documentado?
6. **Testes** — mudou comportamento sem o teste exigido pela matriz em `.specs/codebase/TESTING.md`?

## 3. Comente

- Poste **comentários inline** citando `arquivo:linha` em cada ponto encontrado.
- Classifique cada achado por severidade: **`bloqueante`**, **`importante`** ou **`nit`**. Foque em bloqueante/importante; não floode de nits.
- No fim, poste um **resumo em português** com um **checklist do DoD**: cada critério de aceite relevante marcado como **✅ atendido**, **⚠️ parcial** ou **❌ não atendido**, com referência ao critério em `spec.md`.
- **SEMPRE** poste pelo menos o resumo, mesmo que o diff esteja limpo — nesse caso, afirme explicitamente que o diff está consistente com o DoD.

## Não faça

- Não comente estilo já coberto por lint/prettier.
- Não aprove formalmente o PR (apenas comente) — a aprovação é humana.
- Não invente critérios de aceite que não existam na spec.
- Em modo discussão (`/claude`): apenas responda/proponha; **não** edite arquivos nem faça commit. A aplicação só acontece via `/fix`.
