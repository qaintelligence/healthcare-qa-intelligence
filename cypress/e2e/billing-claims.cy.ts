/// <reference types="cypress" />
import { makeClaim } from '../../shared/data/patient-factory.ts';

describe('Workflow — insurance claims & billing', () => {
  beforeEach(() => cy.login());

  it('submits a new claim and shows it as processing', () => {
    const claim = makeClaim();
    cy.visit('/billing');
    cy.getByTestId('claim-service').type(claim.service);
    cy.getByTestId('claim-amount').type(String(claim.amount));
    cy.getByTestId('claim-submit').click();

    // Assert on the unique returned claim id — robust against accumulated state.
    cy.getByTestId('claim-confirm').invoke('text').then((text) => {
      const id = text.match(/clm-\d+/i)?.[0] as string;
      expect(id, text).to.be.a('string');
      cy.getByTestId('claim-table').contains('tr', id).within(() => {
        cy.getByTestId('claim-status').should('have.text', 'Processing');
      });
    });
  });

  it('shows the seeded "Paid" claim with its status', () => {
    cy.visit('/billing');
    cy.getByTestId('claim-table').contains('tr', 'Annual physical').within(() => {
      cy.getByTestId('claim-status').should('have.text', 'Paid');
    });
  });
});
