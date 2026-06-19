/// <reference types="cypress" />

describe('Workflow — prescription refills', () => {
  beforeEach(() => cy.login());

  it('requests a refill and reflects the new status', () => {
    cy.visit('/prescriptions');
    cy.getByTestId('rx-refill').not('[disabled]').first().click();
    cy.getByTestId('rx-msg').should('be.visible').and('contain.text', 'Refill requested');
    cy.getByTestId('rx-status').contains('Refill requested').should('exist');
  });

  it('disables refill for medications with none remaining', () => {
    cy.visit('/prescriptions');
    // Lisinopril (rx-2002) is seeded with 0 refills remaining.
    cy.get('tr[data-rx="rx-2002"]').find('[data-testid="rx-refill"]').should('be.disabled');
  });
});
