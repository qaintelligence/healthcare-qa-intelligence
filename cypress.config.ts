import { defineConfig } from 'cypress';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:4300';

export default defineConfig({
  e2e: {
    baseUrl: BASE_URL,
    specPattern: 'cypress/e2e/**/*.cy.{ts,js}',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 8000,
    viewportWidth: 1280,
    viewportHeight: 800,
    retries: { runMode: 2, openMode: 0 },
    env: {
      // Surfaced to specs via Cypress.env(...)
      TEST_DATA_SEED: process.env.TEST_DATA_SEED ?? '20260619',
    },
    setupNodeEvents(on) {
      // Task hook lets specs log self-healing / AI events to the terminal.
      on('task', {
        log(message: string) {
          // eslint-disable-next-line no-console
          console.log(message);
          return null;
        },
      });
    },
  },
});
