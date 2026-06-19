import type { Page, Locator } from '@playwright/test';
import { resolveSelector, type LocatorSpec } from '../../shared/ai/self-healing.ts';

/**
 * Base page object that wires the framework-agnostic self-healing engine to Playwright.
 *
 * `smart()` takes a LocatorSpec (primary + fallback selectors) and returns a normal
 * Playwright Locator pointed at whichever candidate currently resolves — logging a
 * heal event (and an AI-suggested durable selector, if a key is set) when it has to
 * fall back. Tests use the returned Locator exactly like any other.
 */
export class BasePage {
  constructor(public readonly page: Page) {}

  async smart(spec: LocatorSpec): Promise<Locator> {
    // Resolve on existence (exactly one match), NOT visibility: confirmation/error
    // elements exist in the DOM but start hidden. Visibility is then asserted by the
    // caller via Playwright's auto-waiting expect(), which avoids resolve-time races.
    const probe = async (selector: string) => (await this.page.locator(selector).count()) === 1;
    const domSnapshot = async () => this.page.content();
    const selector = await resolveSelector(spec, probe, domSnapshot);
    return this.page.locator(selector);
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }
}
