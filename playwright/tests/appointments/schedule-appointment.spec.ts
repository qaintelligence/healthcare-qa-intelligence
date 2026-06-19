import { test, expect } from '../../fixtures/test-fixtures.ts';
import { makeAppointment } from '../../../shared/data/patient-factory.ts';

test.describe('Workflow — appointment scheduling', () => {
  test.beforeEach(async ({ portal }) => {
    await portal.login();
  });

  test('patient books a new appointment with AI-generated synthetic data', async ({ portal }) => {
    const appt = await makeAppointment(); // reason-for-visit is AI-generated when a key is set
    const confirmation = await portal.bookAppointment(appt);

    expect(confirmation).toMatch(/confirmation CNF-/i);
    // New appointment appears in the table.
    await expect(portal.page.getByTestId('appt-row').filter({ hasText: appt.provider })).toBeVisible();
  });

  test('booking requires the mandatory fields', async ({ portal }) => {
    await portal.goto('/appointments');
    await portal.page.getByTestId('appt-submit').click();
    // Native constraint validation keeps an invalid form from submitting.
    const specialty = portal.page.getByTestId('appt-specialty');
    const valid = await specialty.evaluate((el: HTMLSelectElement) => el.checkValidity());
    expect(valid).toBe(false);
    await expect(portal.page.getByTestId('appt-confirm')).toBeHidden();
  });
});
