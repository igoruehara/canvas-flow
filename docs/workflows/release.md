# Workflow — Release (canvas_flow)

> Concrete instance of the generic [release playbook](../../boilerplate_ai/docs/workflows/04-release.md),
> wired to this repo. This doc is the **orchestration view** (when/sequence/gates); the **mechanics**
> (exact commands, guard, troubleshooting) live in the skill — follow the hooks.

## When this runs

- After changes on `main` are green and worth promoting to a public npm version.
- **Not** on every merge — a merge only runs CI; it does **not** publish.

## The flow

```
green main ──► npm version bump ──► push tag vX.Y.Z ──► GitHub Actions publishes ──► verify on npm
                  │                      │                    │
              commit + tag           tag = the           OIDC trusted publishing
              casados                publish trigger      (no NPM_TOKEN); version
              (SemVer)               (only v* tags)       guard aborts on mismatch
```

## Steps + hooks

1. **Confirm** `main` updated and CI green.
2. **Bump** version in `npm_canvas_flow/package.json` (creates matched commit + tag).
   → [npm-release skill — EXECUTE](../../.claude/skills/npm-release/SKILL.md)
3. **Push** commit + tag: `git push origin main --follow-tags`. Pushing the `v*` tag is what publishes.
   → [npm-release skill — the golden rule](../../.claude/skills/npm-release/SKILL.md)
4. **Watch** the pipeline: `gh run watch --exit-status`.
   → [.github/workflows/publish-npm.yml](../../.github/workflows/publish-npm.yml)
5. **Verify**: `npm view @igoruehara/canvas-flow version`.

## Hand-offs

- **In:** green `main` with releasable changes; version source of truth is `npm_canvas_flow/package.json`.
- **Out:** `@igoruehara/canvas-flow@X.Y.Z` published with provenance; tag in git history.
- **Next:** continue the [SDD loop](../../.specs/) for the next feature.

## Gates / Done when

- [ ] CI green on `main` before tagging
- [ ] Tag `vX.Y.Z` **matches** `package.json` version (CI guard fails the publish otherwise)
- [ ] `publish-npm.yml` finished green
- [ ] New version visible via `npm view`

## Anti-patterns (repo-specific)

- **`npm publish` locally** → fails by design (OIDC is CI-only). Always release via the tag.
- **Tag without `v` prefix** → workflow ignores it.
- **Tag ≠ package.json** → guard aborts. Let `npm version` create the tag so they match.
- **Re-publishing a version** → npm forbids overwrite; bump and tag a new one (`npm deprecate` the bad one).

> Full command paths, manual-bump fallback, and troubleshooting table: [npm-release skill](../../.claude/skills/npm-release/SKILL.md).
