# Self-healing locators

UI tests break most often because a selector drifted — a class was renamed, a button moved.
The self-healing engine (`shared/ai/self-healing.ts`) makes a test resilient by declaring
**intent + ordered fallbacks** instead of a single brittle selector.

## How it works

A `LocatorSpec` declares the element:

```ts
{
  name: 'login.submit',
  description: 'Sign in submit button',
  selectors: [
    'button.legacy-signin-cta',     // primary (may have drifted)
    '[data-testid="login-submit"]', // resilient fallback
    'button[type="submit"]',        // last resort
  ],
}
```

At runtime the engine probes each candidate in order and uses the first that resolves to
exactly one visible element. If it has to fall back from the primary, it records a **heal
event**:

```
[self-heal] "login.submit" primary selector failed → healed to [data-testid="login-submit"]
[self-heal] AI suggests durable selector: [data-testid="login-submit"]
```

The test still passes (no false failure), but the drift is now visible so the team can fix
the primary selector deliberately.

## AI suggestions

When `ANTHROPIC_API_KEY` is set, each heal event also asks Claude to propose the single most
durable selector given the element's intent and the live DOM — a concrete fix suggestion,
not just a warning.

## Where heal events surface

- **Playwright**: attached to the HTML report as `self-heal-events.json` (see
  `playwright/fixtures/test-fixtures.ts`).
- **Cypress**: logged to the command log and the terminal via `cy.task('log', ...)`.

## Adapters

The engine is framework-agnostic — it takes a `probe(selector) => Promise<boolean>` callback:

- **Playwright** — `playwright/pages/base.page.ts` (`smart()` returns a real `Locator`).
- **Cypress** — `cypress/support/commands.ts` (`cy.smartGet()` yields the jQuery element).

> Self-healing is a safety net, not a license for brittle selectors. Treat heal events as
> debt to pay down, not noise to ignore.
