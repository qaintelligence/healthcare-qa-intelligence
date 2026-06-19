/**
 * Self-healing locator engine.
 *
 * A `LocatorSpec` declares a primary selector plus ordered fallbacks and a
 * human-readable description of the element's intent. At runtime the engine probes
 * each candidate in order; if the primary fails but a fallback succeeds, it records a
 * "heal" event so the team can fix the flaky selector. When an API key is present,
 * it additionally asks Claude to propose a durable, resilient selector based on the
 * element's intent and the surrounding DOM.
 *
 * The engine is framework-agnostic: it takes a `probe` callback that returns whether a
 * given selector currently resolves to exactly one visible element. Playwright and
 * Cypress each supply their own probe (see playwright/pages and cypress/support).
 */

import { askClaude, aiEnabled } from './ai-client.ts';

export interface LocatorSpec {
  /** Stable name for logs/reports, e.g. "appointment.bookButton". */
  name: string;
  /** Ordered candidate selectors — most-preferred first. */
  selectors: string[];
  /** Plain-English description of the element's purpose (used for AI suggestions). */
  description: string;
}

export interface HealEvent {
  name: string;
  primary: string;
  healedTo: string;
  aiSuggestion?: string | null;
  at: string;
}

const healLog: HealEvent[] = [];

export function getHealLog(): readonly HealEvent[] {
  return healLog;
}
export function clearHealLog(): void {
  healLog.length = 0;
}

export type Probe = (selector: string) => Promise<boolean>;

/**
 * Resolve a spec to the first selector that currently works.
 * Records a heal event when a non-primary selector had to be used.
 * Throws when nothing resolves — the caller surfaces a clear, actionable failure.
 */
export async function resolveSelector(
  spec: LocatorSpec,
  probe: Probe,
  domSnapshot?: () => Promise<string>,
): Promise<string> {
  for (let i = 0; i < spec.selectors.length; i++) {
    const selector = spec.selectors[i];
    // eslint-disable-next-line no-await-in-loop
    const found = await probe(selector).catch(() => false);
    if (!found) continue;

    if (i > 0) {
      const event: HealEvent = {
        name: spec.name,
        primary: spec.selectors[0],
        healedTo: selector,
        at: new Date().toISOString(),
      };
      if (aiEnabled() && domSnapshot) {
        // eslint-disable-next-line no-await-in-loop
        event.aiSuggestion = await suggestSelector(spec, await domSnapshot().catch(() => ''));
      }
      healLog.push(event);
      // eslint-disable-next-line no-console
      console.warn(
        `[self-heal] "${spec.name}" primary selector failed → healed to ${selector}` +
          (event.aiSuggestion ? `\n[self-heal] AI suggests durable selector: ${event.aiSuggestion}` : ''),
      );
    }
    return selector;
  }
  throw new Error(
    `[self-heal] Could not resolve "${spec.name}". Tried: ${spec.selectors.join(', ')}.\n` +
      `Intent: ${spec.description}`,
  );
}

/** Ask Claude for a resilient selector given the element's intent and current DOM. */
export async function suggestSelector(spec: LocatorSpec, domSnapshot: string): Promise<string | null> {
  const prompt =
    `An automated test element named "${spec.name}" (intent: ${spec.description}) has a broken ` +
    `primary selector. Given this DOM, return ONLY the single most resilient CSS selector ` +
    `(prefer a data-testid, then a stable id/role, avoid nth-child and brittle class chains):\n\n` +
    domSnapshot.slice(0, 6000);
  return askClaude(prompt, {
    system: 'You are a test-automation expert. Reply with a single CSS selector and nothing else.',
    maxTokens: 120,
  });
}
