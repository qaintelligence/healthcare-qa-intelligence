import { test, expect } from '../../fixtures/test-fixtures.ts';
import { makePatient } from '../../../shared/data/patient-factory.ts';

test.describe('Patient portal — authentication', () => {
  test('valid credentials sign the patient in (with self-healing login button)', async ({ portal }) => {
    await portal.login();
    await portal.expectLoggedIn();
    await expect(portal.page).toHaveURL(/\/dashboard/);
  });

  test('invalid credentials show a generic error and stay on the login page', async ({ portal }) => {
    const fake = makePatient();
    await portal.goto('/login');
    await portal.page.getByTestId('login-email').fill(fake.email);
    await portal.page.getByTestId('login-password').fill('wrong-password');
    await portal.page.getByTestId('login-submit').click();

    const error = portal.page.getByTestId('login-error');
    await expect(error).toBeVisible();
    // Generic message — must not reveal whether the account exists (anti-enumeration).
    await expect(error).toHaveText(/invalid email or password/i);
    await expect(portal.page).toHaveURL(/\/login/);
  });

  test('protected pages redirect anonymous users to login', async ({ portal }) => {
    await portal.goto('/billing');
    await expect(portal.page).toHaveURL(/\/login/);
  });

  test('logout clears the session', async ({ portal }) => {
    await portal.login();
    await portal.page.getByTestId('logout').click();
    await expect(portal.page).toHaveURL(/\/login/);
    await portal.goto('/dashboard');
    await expect(portal.page).toHaveURL(/\/login/); // session really gone
  });
});
