# Architecture

```
ai-healthcare-test-automation/
├── mock-app/              # Dependency-free Node "patient portal" — the system under test
│   └── server.mjs         # Auth, appointments, prescriptions, claims + security headers
├── shared/                # Framework-agnostic engine shared by BOTH suites
│   ├── ai/
│   │   ├── ai-client.ts       # Anthropic wrapper (no-op without an API key)
│   │   ├── self-healing.ts    # Locator self-healing engine + AI selector suggestions
│   │   └── nl-to-steps.ts     # CLI: plain English → runnable test
│   ├── data/patient-factory.ts # Synthetic, HIPAA-safe test data (faker, seeded)
│   └── security/checks.ts      # Reusable security assertions (headers, cookies, PHI-in-URL)
├── playwright/            # Playwright suite (page objects, fixtures, specs)
└── cypress/              # Cypress suite (commands, specs)
```

## Why a bundled mock app

The suites target a **local synthetic app**, not a real healthcare system. This makes the
repo:

- **Runnable by anyone** — `npm i && npm run e2e`, no credentials, no VPN.
- **Deterministic** — seeded data → stable assertions and visual baselines.
- **Safe** — there is no scenario where this code touches real PHI or a production system.

`BASE_URL` is configurable, so the same specs can run against an **authorized** staging
environment by exporting `BASE_URL=https://staging.internal.example`. Never point them at a
system you are not explicitly authorized to test.

## The shared engine

The key design decision is that AI logic, self-healing, data generation, and security checks
live in `shared/` and are consumed identically by Playwright and Cypress through thin
adapters (`playwright/pages/base.page.ts` and `cypress/support/commands.ts`). One mental
model, two runners.

## Graceful AI degradation

Every AI feature checks for `ANTHROPIC_API_KEY` and falls back to deterministic behaviour
when it is absent. CI runs entirely without a key and is fully green; supplying a key
"upgrades" the same tests with live AI suggestions and generated data.
