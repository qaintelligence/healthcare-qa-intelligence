import { test, expect } from '../../fixtures/test-fixtures.ts';

test.describe('Workflow — prescription refills', () => {
  test.beforeEach(async ({ portal }) => {
    await portal.login();
  });

  test('patient requests a refill and the status updates', async ({ portal }) => {
    await portal.requestFirstRefill();
    await expect(portal.page.getByTestId('rx-status').filter({ hasText: 'Refill requested' }).first()).toBeVisible();
  });

  test('medications with zero refills remaining cannot be refilled', async ({ portal }) => {
    await portal.goto('/prescriptions');
    // Lisinopril (rx-2002) is seeded with 0 refills → button disabled.
    const disabledRow = portal.page.locator('tr[data-rx="rx-2002"]');
    await expect(disabledRow.getByTestId('rx-refill')).toBeDisabled();
  });
});
