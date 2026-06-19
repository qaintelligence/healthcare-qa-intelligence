#!/usr/bin/env node
/**
 * AI-assisted test authoring CLI.
 *
 * Turns a plain-English scenario into a runnable Playwright (or Cypress) test that
 * matches this repo's conventions (data-testid selectors, the SmartLocator pattern,
 * synthetic data factories). It feeds Claude the project's authoring guide so output
 * is consistent with the existing suites.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... node --experimental-strip-types shared/ai/nl-to-steps.ts \
 *     --framework playwright "Patient logs in and reschedules their cardiology appointment"
 *
 * Without a key it prints a ready-to-fill scaffold so the workflow still works offline.
 */

import { askClaude, aiEnabled } from './ai-client.ts';

const AUTHORING_GUIDE = `
Conventions for this repo:
- Selectors: always prefer page.getByTestId('...') / [data-testid].
- Use the synthetic factories from shared/data/patient-factory.ts (makePatient, makeAppointment, makeClaim). Never hardcode PHI.
- Demo login: patient@example.com / Test1234!.
- Assertions use Playwright's web-first expect(...).toBeVisible()/toHaveText().
- Keep each test focused on one workflow; add a11y check via @axe-core/playwright where relevant.
Available data-testids: login-email, login-password, login-submit, login-error, welcome, mrn,
  card-appointments, card-prescriptions, card-billing, appt-table, appt-specialty, appt-provider,
  appt-date, appt-time, appt-reason, appt-submit, appt-confirm, rx-table, rx-refill, rx-status,
  rx-msg, claim-table, claim-service, claim-amount, claim-submit, claim-confirm, logout.
`;

function scaffold(framework: string, scenario: string): string {
  if (framework === 'cypress') {
    return `// AI-authoring scaffold (offline). Scenario: ${scenario}
describe('${scenario}', () => {
  it('completes the workflow', () => {
    cy.login(); // custom command
    // TODO: implement steps for: ${scenario}
    // Example: cy.getByTestId('card-appointments').click();
  });
});
`;
  }
  return `// AI-authoring scaffold (offline). Scenario: ${scenario}
import { test, expect } from '../fixtures/test-fixtures.ts';

test('${scenario}', async ({ portal }) => {
  await portal.login();
  // TODO: implement steps for: ${scenario}
  // Example: await portal.page.getByTestId('card-appointments').click();
  await expect(portal.page).toHaveURL(/dashboard|appointments/);
});
`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fwIdx = args.indexOf('--framework');
  const framework = fwIdx >= 0 ? args[fwIdx + 1] : 'playwright';
  const scenario = args.filter((a, i) => i !== fwIdx && i !== fwIdx + 1 && !a.startsWith('--')).join(' ').trim();

  if (!scenario) {
    console.error('Usage: nl-to-steps.ts [--framework playwright|cypress] "<scenario in plain English>"');
    process.exit(1);
  }

  if (!aiEnabled()) {
    console.error('[nl-to-steps] No ANTHROPIC_API_KEY — emitting an offline scaffold.\n');
    console.log(scaffold(framework, scenario));
    return;
  }

  const code = await askClaude(
    `Write a single ${framework} test for this scenario:\n"${scenario}"\n\n${AUTHORING_GUIDE}\n` +
      `Return ONLY the test file contents, no explanation, no markdown fences.`,
    { system: 'You are a senior SDET. Output only runnable test code.', maxTokens: 1500 },
  );

  console.log(code ?? scaffold(framework, scenario));
}

main();
