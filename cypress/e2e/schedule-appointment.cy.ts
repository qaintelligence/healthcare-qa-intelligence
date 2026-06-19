/// <reference types="cypress" />
import { makeAppointment } from '../../shared/data/patient-factory.ts';

describe('Workflow — appointment scheduling', () => {
  beforeEach(() => cy.login());

  it('books a new appointment using synthetic data', () => {
    // makeAppointment is async (AI reason-for-visit); wrap to use inside the Cypress chain.
    cy.wrap(makeAppointment()).then((result) => {
      const appt = result as Awaited<ReturnType<typeof makeAppointment>>;
      cy.visit('/appointments');
      cy.getByTestId('appt-specialty').select(appt.specialty);
      cy.getByTestId('appt-provider').type(appt.provider);
      cy.getByTestId('appt-date').type(appt.date);
      cy.getByTestId('appt-time').type(appt.time);
      cy.getByTestId('appt-reason').type(appt.reason);
      cy.getByTestId('appt-submit').click();

      cy.getByTestId('appt-confirm').should('be.visible').and('contain.text', 'confirmation CNF-');
      cy.getByTestId('appt-table').contains('td', appt.provider).should('exist');
    });
  });

  it('enforces required fields', () => {
    cy.visit('/appointments');
    cy.getByTestId('appt-submit').click();
    cy.getByTestId('appt-specialty').then(($el) => {
      expect(($el[0] as HTMLSelectElement).checkValidity()).to.eq(false);
    });
    cy.getByTestId('appt-confirm').should('not.be.visible');
  });
});
