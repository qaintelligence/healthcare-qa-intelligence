/// <reference types="cypress" />
import 'cypress-axe';

/**
 * WCAG 2.1 AA accessibility scan via cypress-axe. Fails on serious/critical issues.
 */
function auditSerious(label: string) {
  cy.injectAxe();
  cy.checkA11y(
    undefined,
    { includedImpacts: ['serious', 'critical'], runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } },
    (violations) => {
      if (violations.length) {
        cy.task('log', `[a11y] ${label}: ${violations.map((v) => v.id).join(', ')}`);
      }
    },
  );
}

describe('Accessibility (WCAG 2.1 AA)', () => {
  it('login page is accessible', () => {
    cy.visit('/login');
    auditSerious('login');
  });

  ['/dashboard', '/appointments', '/prescriptions', '/billing'].forEach((path) => {
    it(`authenticated page ${path} is accessible`, () => {
      cy.login();
      cy.visit(path);
      auditSerious(path);
    });
  });
});
