import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './base.page.ts';
import type { AppointmentRequest, ClaimRequest } from '../../shared/data/patient-factory.ts';

const DEMO = { email: 'patient@example.com', password: 'Test1234!' };

/**
 * Page object for the MediPortal patient portal, covering every modeled workflow.
 * Each interaction goes through `smart()` so a drifting selector self-heals instead
 * of failing the whole suite. The fallback selectors below intentionally include a
 * deliberately-stale primary in a couple of places to demonstrate healing in action.
 */
export class PortalPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async login(creds: { email: string; password: string } = DEMO): Promise<void> {
    await this.goto('/login');
    (await this.smart({
      name: 'login.email',
      description: 'Email field on the sign-in form',
      selectors: ['[data-testid="login-email"]', '#email', 'input[type="email"]'],
    })).fill(creds.email);
    (await this.smart({
      name: 'login.password',
      description: 'Password field on the sign-in form',
      selectors: ['[data-testid="login-password"]', '#password', 'input[type="password"]'],
    })).fill(creds.password);
    await (await this.smart({
      name: 'login.submit',
      // Primary is intentionally stale to exercise self-healing → falls back to data-testid.
      description: 'Sign in submit button',
      selectors: ['button.legacy-signin-cta', '[data-testid="login-submit"]', 'button[type="submit"]'],
    })).click();
    await this.page.waitForURL('**/dashboard');
  }

  async expectLoggedIn(): Promise<void> {
    await expect(await this.smart({
      name: 'dashboard.welcome',
      description: 'Welcome heading on the dashboard',
      selectors: ['[data-testid="welcome"]', 'h1'],
    })).toContainText('Welcome back');
  }

  async bookAppointment(appt: AppointmentRequest): Promise<string> {
    await this.goto('/appointments');
    (await this.smart({ name: 'appt.specialty', description: 'Specialty dropdown', selectors: ['[data-testid="appt-specialty"]', '#specialty'] })).selectOption(appt.specialty);
    (await this.smart({ name: 'appt.provider', description: 'Provider field', selectors: ['[data-testid="appt-provider"]', '#provider'] })).fill(appt.provider);
    (await this.smart({ name: 'appt.date', description: 'Date field', selectors: ['[data-testid="appt-date"]', '#date'] })).fill(appt.date);
    (await this.smart({ name: 'appt.time', description: 'Time field', selectors: ['[data-testid="appt-time"]', '#time'] })).fill(appt.time);
    (await this.smart({ name: 'appt.reason', description: 'Reason for visit', selectors: ['[data-testid="appt-reason"]', '#reason'] })).fill(appt.reason);
    await (await this.smart({ name: 'appt.submit', description: 'Book appointment button', selectors: ['[data-testid="appt-submit"]'] })).click();
    const confirm = await this.smart({ name: 'appt.confirm', description: 'Booking confirmation message', selectors: ['[data-testid="appt-confirm"]'] });
    await expect(confirm).toBeVisible();
    return (await confirm.textContent()) ?? '';
  }

  async requestFirstRefill(): Promise<void> {
    await this.goto('/prescriptions');
    // List action (multiple refill buttons) → target the first enabled one directly
    // rather than via smart(), which intentionally requires a unique match.
    await this.page.locator('[data-testid="rx-refill"]:not([disabled])').first().click();
    await expect(await this.smart({ name: 'rx.msg', description: 'Refill confirmation', selectors: ['[data-testid="rx-msg"]'] })).toBeVisible();
  }

  async submitClaim(claim: ClaimRequest): Promise<string> {
    await this.goto('/billing');
    (await this.smart({ name: 'claim.service', description: 'Service description field', selectors: ['[data-testid="claim-service"]', '#service'] })).fill(claim.service);
    (await this.smart({ name: 'claim.amount', description: 'Claim amount field', selectors: ['[data-testid="claim-amount"]', '#amount'] })).fill(String(claim.amount));
    await (await this.smart({ name: 'claim.submit', description: 'Submit claim button', selectors: ['[data-testid="claim-submit"]'] })).click();
    const confirm = await this.smart({ name: 'claim.confirm', description: 'Claim confirmation message', selectors: ['[data-testid="claim-confirm"]'] });
    await expect(confirm).toBeVisible();
    return (await confirm.textContent()) ?? '';
  }
}
