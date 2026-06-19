import { test, expect } from '../../fixtures/test-fixtures.ts';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility is non-negotiable for healthcare (Section 508 / WCAG 2.1 AA).
 * We run axe-core against every key screen and fail on serious/critical violations.
 */
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test.describe('Accessibility (WCAG 2.1 AA via axe-core)', () => {
  test('login page has no serious/critical violations', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
    expect(serious, JSON.stringify(serious.map((v) => v.id), null, 2)).toEqual([]);
  });

  for (const path of ['/dashboard', '/appointments', '/prescriptions', '/billing']) {
    test(`authenticated page ${path} has no serious/critical violations`, async ({ portal, page }) => {
      await portal.login();
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
      expect(serious, JSON.stringify(serious.map((v) => v.id), null, 2)).toEqual([]);
    });
  }
});
