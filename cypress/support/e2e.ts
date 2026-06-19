import './commands.ts';

// Fail fast on uncaught app exceptions so real regressions aren't masked.
// (Narrow this if the app under test has known, benign console errors.)
Cypress.on('uncaught:exception', () => true);
