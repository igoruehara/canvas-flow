# Workflow 04 — Release

> How a validated state on the main branch becomes a published version. Generic playbook — each project
> wires the **hooks** below to its own release skill (npm, container image, app store, etc.).

## When this runs

- After one or more features have passed [Validate](01-sdd-loop.md) and the main branch is green.
- **Not** on every merge. You batch changes and choose *when* to cut a version.
- Skip if: work in progress, no user-facing change worth a version, or CI is red on main.

## The flow

```
green main ──► bump version ──► tag ──► CI publishes ──► verify in registry
                  │              │          │
              SemVer         tag = the    no secrets on your machine —
            (patch/minor/    publish      CI authenticates (prefer OIDC /
              major)         trigger      trusted publishing over stored tokens)
```

## Steps + hooks

> Replace the placeholder hook with your project's release skill. The market-standard pattern is
> **tag-driven publish via CI** (a pushed version tag triggers the pipeline; CI authenticates with
> short-lived OIDC credentials instead of a stored token).

1. **Confirm** main is updated and CI is green. → [01-sdd-loop](01-sdd-loop.md)
2. **Bump** the version (SemVer) — let the tooling create the commit + tag together so they can't diverge.
   → *hook:* `[<your-release-skill>](../../.claude/skills/<release-skill>/SKILL.md)`
3. **Tag & push** — pushing the version tag is what publishes. Nothing else should.
4. **Watch** the CI pipeline to green.
5. **Verify** the new version is live in the registry.

## Hand-offs

- **In:** a green main with changes worth releasing.
- **Out:** a published, immutable version + a tag in git history.
- **Next:** back to the [SDD loop](01-sdd-loop.md) for the next feature.

## Gates / Done when

- [ ] CI green on main before the tag
- [ ] Version bump and tag **match** (a CI guard should fail the publish if they diverge)
- [ ] Pipeline published successfully
- [ ] New version confirmed in the registry

## Anti-patterns

- **Publishing from your laptop.** Releases should come from CI, reproducibly — not a local `publish`.
- **Tag ≠ manifest version.** Always let the bump tool create the tag; a guard step must abort on mismatch.
- **Storing a long-lived publish token** when the registry supports OIDC/trusted publishing. Prefer no secret.
- **Releasing unvalidated work.** A release is a promotion of *validated* state, not "whatever is on main".

> Reference implementation (concrete): this repo's tag-driven npm release via GitHub Actions + OIDC —
> see the `npm-release` skill and `docs/workflows/release.md` in the canvas_flow repo.
