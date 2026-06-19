import { test as base } from '@playwright/test';
import { PortalPage } from '../pages/portal.page.ts';
import { clearHealLog, getHealLog } from '../../shared/ai/self-healing.ts';

/**
 * Custom fixtures:
 *  - `portal`: ready-to-use PortalPage (self-healing page object).
 *  - automatic heal-log reporting: after each test, any self-heal events are attached
 *    to the Playwright report so selector drift is visible in CI artifacts.
 */
export const test = base.extend<{ portal: PortalPage }>({
  portal: async ({ page }, use) => {
    clearHealLog();
    await use(new PortalPage(page));
    const heals = getHealLog();
    if (heals.length) {
      await test.info().attach('self-heal-events.json', {
        body: JSON.stringify(heals, null, 2),
        contentType: 'application/json',
      });
    }
  },
});

export { expect } from '@playwright/test';
