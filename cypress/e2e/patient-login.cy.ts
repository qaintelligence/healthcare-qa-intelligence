/// <reference types="cypress" />

describe('Patient portal — authentication', () => {
  it('signs in with valid credentials (self-healing login button)', () => {
    cy.visit('/login');
    cy.smartGet({
      name: 'login.email',
      description: 'Email field',
      selectors: ['[data-testid="login-email"]', '#email'],
    }).type('patient@example.com');
    cy.getByTestId('login-password').type('Test1234!', { log: false });
    // Primary selector is intentionally stale → command self-heals to the data-testid.
    cy.smartGet({
      name: 'login.submit',
      description: 'Sign in button',
      selectors: ['button.legacy-signin-cta', '[data-testid="login-submit"]', 'button[type="submit"]'],
    }).click();

    cy.location('pathname').should('eq', '/dashboard');
    cy.getByTestId('welcome').should('contain.text', 'Welcome back');
  });

  it('shows a generic error for invalid credentials', () => {
    cy.visit('/login');
    cy.getByTestId('login-email').type('patient@example.com');
    cy.getByTestId('login-password').type('wrong-password', { log: false });
    cy.getByTestId('login-submit').click();
    cy.getByTestId('login-error').should('be.visible').and('contain.text', 'Invalid email or password');
    cy.location('pathname').should('eq', '/login');
  });

  it('redirects anonymous users away from protected pages', () => {
    cy.visit('/prescriptions');
    cy.location('pathname').should('eq', '/login');
  });
});
