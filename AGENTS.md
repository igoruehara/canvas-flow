# AGENTS.md

## Project Operating Mode

This repository uses TLC Spec-Driven Development.

The canonical project memory lives in `.specs/`, not in `.cursor/`.

Use `.cursor/skills/tlc-spec-driven/` only as a local reference copy of the TLC workflow. Do not eagerly load the whole Cursor skill. Read only the specific reference file needed for the current phase.

## On-Demand TLC Loading

Start every feature/task session with the smallest useful context:

1. Read `.specs/project/STATE.md`.
2. If planning or choosing work, read `.specs/project/ROADMAP.md`.
3. If working on an active feature, read only that feature folder under `.specs/features/<feature>/`.
4. Load `.specs/codebase/TESTING.md` before creating tasks or running execution.
5. Load `.specs/codebase/CONCERNS.md` before designing or modifying fragile areas.

Only load Cursor TLC references when the user asks for that phase or the workflow requires it:

- Specify feature: `.cursor/skills/tlc-spec-driven/references/specify.md`
- Discuss gray areas: `.cursor/skills/tlc-spec-driven/references/discuss.md`
- Design feature: `.cursor/skills/tlc-spec-driven/references/design.md`
- Create tasks: `.cursor/skills/tlc-spec-driven/references/tasks.md`
- Execute task: `.cursor/skills/tlc-spec-driven/references/implement.md`
- Validate/UAT: `.cursor/skills/tlc-spec-driven/references/validate.md`
- Quick task: `.cursor/skills/tlc-spec-driven/references/quick-mode.md`
- State/session handoff: `.cursor/skills/tlc-spec-driven/references/state-management.md` or `session-handoff.md`
- Codebase mapping: `.cursor/skills/tlc-spec-driven/references/brownfield-mapping.md`

When a TLC reference is selected, read that file completely before acting on the phase.

## TLC Workflow Rules

Follow this flow for planned feature work:

`Specify -> Design -> Tasks -> Execute -> Validate`

Auto-size the ceremony:

- Small fixes: use quick mode.
- Medium work: spec plus inline execution is enough.
- Large or multi-component work: create/use `spec.md`, `design.md`, and `tasks.md`.

For this repository, multi-surface changes touching backend, frontend, CLI, bundle, or runtime are Large and should use formal `design.md` and `tasks.md`.

## Execution Rules

When executing a task from `tasks.md`:

1. Read the exact task definition and its dependencies.
2. Read the relevant spec/design sections for the requirement IDs.
3. Keep the implementation scoped to that task.
4. Add or update tests in the same task when the testing matrix requires it.
5. Run the task gate listed in `tasks.md`.
6. Update `tasks.md` with completion status, gate result, and test count.
7. Update `.specs/project/STATE.md` with the next task.

Do not mark a requirement `Verified` in `spec.md` until its acceptance criteria have been validated.

## Repository Gates

Use these commands according to `.specs/codebase/TESTING.md`:

- Backend quick gate: `cd backend && npm test -- --runInBand`
- Frontend build gate: `cd frontend && npm run build`
- NPM package gate: `cd npm_canvas_flow && npm run bundle && node bin/canvas-flow.js doctor --offline`

Before npm publishing or validating standalone behavior, regenerate package artifacts with `npm run bundle` from `npm_canvas_flow`.

## Repository Notes

- Backend source of truth is under `backend/src/`.
- Frontend source of truth is under `frontend/src/`.
- `npm_canvas_flow/server/**` and `npm_canvas_flow/public/**` are generated bundle artifacts; do not hand-edit them unless the task is explicitly about generated output or bundle verification.
- Provider config work is currently tracked in `.specs/features/provider-config/`.
- Keep `.specs/` updated as work progresses. It is the cross-session memory for both Codex and Cursor.

## Cursor Compatibility

The `.cursor/` directory may remain in the repo for Cursor users.

For Codex, the durable instruction surface is this `AGENTS.md`. If Cursor TLC guidance changes and should apply to Codex too, update this file with routing rules rather than copying the entire Cursor skill into context.

