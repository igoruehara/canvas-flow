import { test, expect } from '@playwright/test'

/**
 * Smoke suite — one happy path per critical journey.
 * Replace the placeholder journey below with the must-not-break paths identified during
 * Discovery / the feature spec (docs/workflows/03-qa-e2e.md).
 *
 * Conventions:
 *  - One journey per `test`; the name reads as user intent.
 *  - Select by role/text, not brittle CSS/XPath.
 *  - Tests are independent and idempotent.
 *  - AI-backed flows: stub the `AiProvider` with the fake adapter — never call a live model here.
 */

test.describe('smoke: critical journeys', () => {
  test('app loads and shows its primary entry point', async ({ page }) => {
    await page.goto('/')

    // Replace with a real, stable signal that the app rendered.
    await expect(page).toHaveTitle(/.+/)
    // e.g. await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  // Template for the next journey — copy per critical path:
  //
  // test('user can <do the core action>', async ({ page }) => {
  //   await page.goto('/')
  //   await page.getByRole('button', { name: '<action>' }).click()
  //   await expect(page.getByText('<expected result>')).toBeVisible()
  // })
})
