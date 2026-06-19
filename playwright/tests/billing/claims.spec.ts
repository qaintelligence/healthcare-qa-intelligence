import { test, expect } from '../../fixtures/test-fixtures.ts';
import { makeClaim } from '../../../shared/data/patient-factory.ts';

test.describe('Workflow — insurance claims & billing', () => {
  test.beforeEach(async ({ portal }) => {
    await portal.login();
  });

  test('patient submits a new claim and it appears as processing', async ({ portal }) => {
    const claim = makeClaim();
    const confirmation = await portal.submitClaim(claim);

    // Assert on the unique claim id returned — robust against parallel state mutation.
    const id = confirmation.match(/clm-\d+/i)?.[0];
    expect(id, confirmation).toBeTruthy();
    const newRow = portal.page.getByTestId('claim-row').filter({ hasText: id! });
    await expect(newRow).toBeVisible();
    await expect(newRow.getByTestId('claim-status')).toHaveText('Processing');
  });

  test('seeded "Paid" claim is displayed with its status', async ({ portal }) => {
    await portal.goto('/billing');
    // Assert the always-present seeded claim, not a global count (parallel-safe).
    const paidRow = portal.page.getByTestId('claim-row').filter({ hasText: 'Annual physical' });
    await expect(paidRow).toBeVisible();
    await expect(paidRow.getByTestId('claim-status')).toHaveText('Paid');
  });
});
