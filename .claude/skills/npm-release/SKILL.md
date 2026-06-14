---
name: npm-release
description: Cortar uma release do pacote @igoruehara/canvas-flow no npm via tag git + GitHub Actions (OIDC trusted publishing). Explica a mecânica "tag = publish", o guard de versão, e o passo a passo seguro de bump → tag → publish. Use quando o usuário quiser "publicar no npm", "subir no npm", "lançar uma nova versão", "cortar uma release", "fazer bump", "criar a tag", "republicar", ou perguntar como/quando o npm é atualizado. Triggers: "subir no npm", "publicar no npm", "nova versão", "release", "cortar versão", "bump", "tag v", "lançar pacote", "publish npm", "cut a release".
license: CC-BY-4.0
metadata:
  author: Canvas Flow
  version: 1.0.0
---

# npm-release — Publicar Canvas Flow no npm

Release do pacote `@igoruehara/canvas-flow` é **dirigida por tag**. Você não roda `npm publish` na sua máquina; quem publica é o GitHub Actions, autenticado por **OIDC (trusted publishing)** — sem token armazenado em lugar nenhum.

```
┌──────────┐   ┌──────────┐   ┌─────────┐   ┌─────────┐
│ SPECIFY  │ → │  DESIGN  │ → │  TASKS  │ → │ EXECUTE │
└──────────┘   └──────────┘   └─────────┘   └─────────┘
  o que/quando   como funciona   passos        comandos
```

## A regra de ouro (leia isto primeiro)

> **Empurrar uma tag `v*` para o GitHub = publicar no npm. Nada mais publica.**

- ✅ `git push origin v0.1.15` → dispara o publish
- ❌ merge/commit na `main` → **NÃO** publica (só roda CI)
- ❌ tag sem prefixo `v` (`release-1`, `beta`) → ignorada pelo workflow
- ⚠️ a tag `vX.Y.Z` **tem que bater** com a versão do `npm_canvas_flow/package.json`, senão o workflow falha de propósito

**Fonte da verdade da versão:** `npm_canvas_flow/package.json` → campo `version`.

---

## SPECIFY — o que é uma release aqui

Uma release acontece quando você decide promover o estado atual da `main` para uma nova versão pública no npm. Não é automático a cada merge — você junta mudanças e escolhe *quando* lançar.

**Quando NÃO lançar:** trabalho em andamento, sem mudança que justifique versão nova, ou versão ainda não validada (CI vermelha na main).

**Níveis (SemVer):**

| Comando | De → Para | Quando |
| --- | --- | --- |
| `npm version patch` | 0.1.14 → 0.1.15 | correção / ajuste |
| `npm version minor` | 0.1.x → 0.2.0 | feature nova retrocompatível |
| `npm version major` | 0.x → 1.0.0 | breaking change |

---

## DESIGN — como o pipeline funciona

**Arquivo:** [.github/workflows/publish-npm.yml](../../../.github/workflows/publish-npm.yml)

```
git push origin vX.Y.Z
        │
        ▼
GitHub Actions (publish-npm.yml)         permissions: id-token: write
  1. checkout
  2. setup Node 20 + registry npmjs
  3. npm install -g npm@latest           # OIDC exige npm >= 11.5.1
  4. backend:  npm ci --legacy-peer-deps
  5. frontend: npm ci
  6. npm_canvas_flow: npm run bundle      # builda front+back, copia p/ public/ e server/
  7. GUARD: tag (vX.Y.Z) == package.json version?  -> se não, FALHA aqui
  8. npm publish --access public          # via OIDC, com provenance automática
        │
        ▼
   @igoruehara/canvas-flow@X.Y.Z no registry ✅
```

**Por que não precisa de token:** o npm está configurado com um *Trusted Publisher* (npmjs.com → pacote → Settings → Trusted Publisher) apontando para `igoruehara/canvas-flow` + workflow `publish-npm.yml` + ação `npm publish`. O Actions troca um token OIDC efêmero na hora. Nada secreto fica no repo (que é open source).

**O guard de versão (passo 7)** existe para impedir release errada: se a tag e o `package.json` divergirem, ele aborta antes de publicar. Por isso o caminho seguro é deixar o `npm version` criar a tag (ele casa os dois automaticamente).

---

## TASKS — passos de uma release

1. Garantir `main` atualizada e CI verde.
2. Bump de versão no `npm_canvas_flow/package.json` (gera commit + tag casados).
3. Empurrar commit + tag.
4. Acompanhar o workflow.
5. Confirmar a versão no registry.

---

## EXECUTE — comandos

### Caminho padrão (recomendado)

```bash
# 1. main atualizada
git checkout main && git pull

# 2. bump (escolha patch | minor | major) — cria commit + tag vX.Y.Z casados
cd npm_canvas_flow
npm version patch

# 3. empurra commit do bump + a tag
cd .. && git push origin main --follow-tags

# 4. acompanha
gh run watch --exit-status        # ou GitHub → Actions

# 5. confirma
npm view @igoruehara/canvas-flow version    # deve mostrar a nova versão
```

### Bump manual (se precisar criar a tag à mão)

Só funciona se o `package.json` já estiver na versão da tag:

```bash
cd npm_canvas_flow
npm version 0.1.15 --no-git-tag-version     # só edita o package.json
cd ..
git commit -am "chore(npm): bump to 0.1.15"
git tag v0.1.15
git push origin main --follow-tags
```

---

## Edge cases / troubleshooting

| Sintoma | Causa | Solução |
| --- | --- | --- |
| Workflow falha em "Verify tag matches package version" | tag `vX.Y.Z` ≠ `package.json` version | Apague a tag (`git push origin :vX.Y.Z`), bumpe o `package.json` para X.Y.Z, recrie a tag |
| `npm publish` falha "cannot publish over previously published version" | essa versão já está no npm | Bumpe para a próxima versão e tague de novo |
| Tag empurrada mas workflow não rodou | tag não começa com `v` | Use o prefixo `v` (`v0.1.15`) |
| `E404` ao publicar localmente | OIDC é só no Actions; sua máquina não publica | Não publique local — use a tag. (Token local antigo é irrelevante.) |
| Re-tentar uma versão que falhou no meio (e NÃO foi publicada) | passo intermediário quebrou | `git tag vX.Y.Z` (versão já no package.json) e `git push origin vX.Y.Z` |

**Apagar uma tag errada (local + remoto):**
```bash
git tag -d v0.1.15
git push origin :refs/tags/v0.1.15
```

> Releases publicadas no npm **não podem ser sobrescritas**. Se publicou errado, a saída é `npm deprecate` a versão ruim e lançar uma nova. `npm unpublish` só é permitido em janela curta e tem restrições — evite.

---

## Contexto fixo do projeto

- **Pacote:** `@igoruehara/canvas-flow` (scoped, público) — owner `igoruehara`
- **Versão vive em:** `npm_canvas_flow/package.json`
- **Workflow:** `.github/workflows/publish-npm.yml` (trigger: `push: tags: ['v*']` + `workflow_dispatch`)
- **Auth:** OIDC trusted publishing (sem `NPM_TOKEN`), provenance automática
- **Bundle:** `npm run bundle` em `npm_canvas_flow` builda frontend+backend e copia para `public/`/`server/`
- **Hardening opcional:** npmjs.com → pacote → Publishing access → "Require 2FA and disallow tokens" trava tudo exceto o trusted publisher
