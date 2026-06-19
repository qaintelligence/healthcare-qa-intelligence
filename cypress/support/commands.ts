/// <reference types="cypress" />
import 'cypress-axe';
import type { LocatorSpec } from '../../shared/ai/self-healing.ts';

/**
 * Cypress-native self-healing locator. Probes each candidate selector in order and
 * yields the first that exists in the DOM. When it has to fall back from the primary,
 * it logs a heal event to both the Cypress command log and the terminal (via cy.task).
 * This mirrors the Playwright `smart()` helper so both suites share one mental model.
 */
Cypress.Commands.add('smartGet', (spec: LocatorSpec) => {
  // Pick the first candidate that currently exists, then hand off to cy.get(), which
  // brings Cypress's built-in retry-ability and visibility handling. A heal event is
  // logged when we fall back from the primary selector.
  return cy.then(() => {
    const idx = spec.selectors.findIndex((s) => Cypress.$(s).length >= 1);
    if (idx === -1) {
      throw new Error(
        `[self-heal] Could not resolve "${spec.name}". Tried: ${spec.selectors.join(', ')}. Intent: ${spec.description}`,
      );
    }
    if (idx > 0) {
      const msg = `[self-heal] "${spec.name}" healed from "${spec.selectors[0]}" to "${spec.selectors[idx]}"`;
      Cypress.log({ name: 'self-heal', message: msg });
      cy.task('log', msg, { log: false });
    }
    return cy.get(spec.selectors[idx]);
  });
});

Cypress.Commands.add('getByTestId', (testId: string) => cy.get(`[data-testid="${testId}"]`));

/** Log in through the UI using the demo patient (or supplied creds). */
Cypress.Commands.add('login', (email = 'patient@example.com', password = 'Test1234!') => {
  cy.visit('/login');
  cy.getByTestId('login-email').type(email);
  cy.getByTestId('login-password').type(password, { log: false });
  cy.getByTestId('login-submit').click();
  cy.location('pathname').should('eq', '/dashboard');
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      smartGet(spec: LocatorSpec): Chainable<JQuery<HTMLElement>>;
      getByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
      login(email?: string, password?: string): Chainable<void>;
    }
  }
}

export {};
