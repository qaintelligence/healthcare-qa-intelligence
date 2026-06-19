import { test, expect } from '../../fixtures/test-fixtures.ts';

/**
 * AI-style visual regression. Playwright's pixel-diff engine (configured with a small
 * maxDiffPixelRatio in playwright.config.ts to absorb anti-aliasing noise) acts as the
 * deterministic baseline. Baselines are generated on first run with `--update-snapshots`.
 *
 * Only chromium is asserted to avoid cross-engine rendering noise in committed baselines.
 */
test.describe('Visual regression', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Baselines pinned to chromium');

  test('login page matches its visual baseline', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveScreenshot('login.png', { fullPage: true });
  });

  test('dashboard matches its visual baseline', async ({ portal, page }) => {
    await portal.login();
    await page.goto('/dashboard');
    // Mask the live stat counts — they change with state and would make the baseline flaky.
    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      mask: [page.locator('.stat .num')],
    });
  });
});
