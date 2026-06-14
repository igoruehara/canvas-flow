# qa/e2e — End-to-End tests (Playwright)

Critical-journey coverage only. Strategy: [docs/workflows/03-qa-e2e.md](../../docs/workflows/03-qa-e2e.md).
Driven by the [qa-e2e skill](../../.claude/skills/qa-e2e/SKILL.md).

## Setup

```bash
npm i -D @playwright/test
npx playwright install
```

Set the app URL via env (defaults to `http://localhost:3000`):

```bash
E2E_BASE_URL=http://localhost:3000 npx playwright test
```

## Run

```bash
npx playwright test            # headless
npx playwright test --ui       # interactive
npx playwright show-report     # last HTML report
```

## Layout

```
qa/e2e/
├── playwright.config.ts   # config — baseURL, reporters, web server hook
└── tests/
    └── smoke.spec.ts      # one happy path per critical journey
```

## Rules of the road

- One journey per spec file. Selectors by role/text (`getByRole`, `getByText`) — not brittle CSS/XPath.
- Tests are independent and idempotent. No order dependence.
- **Stub AI** with the fake `AiProvider` — never hit a live model in CI. Output quality is an
  [eval](../../docs/ai/evaluations.md) concern, not E2E.
- Keep the smoke suite fast; CI blocks merge on red.
