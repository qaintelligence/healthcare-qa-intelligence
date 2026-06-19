# 🏥 AI Healthcare Test Automation — Cypress + Playwright

End-to-end test automation for healthcare **patient-portal workflows**, built with both
**Playwright** and **Cypress**, and supercharged with practical AI:

- 🩹 **Self-healing locators** — tests survive selector drift and tell you what to fix (with AI-suggested durable selectors).
- ✍️ **AI-assisted authoring** — turn a plain-English scenario into a runnable test.
- 👁️ **Visual + ♿ accessibility AI checks** — pixel-diff baselines and WCAG 2.1 AA scans (axe-core) on every screen.
- 🧬 **Synthetic test-data generation** — realistic, HIPAA-safe, reproducible data (faker + optional LLM).
- 🔐 **Security testing** — headers, hardened cookies, no-PHI-in-URL, anti-enumeration, broken-access-control.

> **Everything runs out of the box.** The suites target a small bundled mock patient portal,
> so `npm install && npm run e2e` is fully green — no accounts, no real systems, no PHI.
> AI features are optional and degrade gracefully without an API key.

<!-- CI-BADGE -->

---

## Modeled healthcare workflows

| Workflow | What it covers |
|---|---|
| 🔑 **Patient login** | Auth, generic error messaging, protected-route redirects, logout/session |
| 📅 **Appointment scheduling** | Book with synthetic data, required-field validation, confirmation |
| 💊 **Prescription refills** | Request refill, status update, zero-refills-remaining guard |
| 🧾 **Insurance claims & billing** | Submit claim, processing status, seeded-claim display |

Cross-cutting: **accessibility**, **visual regression**, and **security** specs for every screen.

## Quick start

```bash
git clone <this-repo>
cd ai-healthcare-test-automation
npm install
npx playwright install   # download Playwright browsers (first time only)

# Run everything (boots the mock app automatically):
npm run e2e              # Playwright + Cypress
npm run e2e:pw          # Playwright only
npm run e2e:cy          # Cypress only
```

Other handy commands:

```bash
npm run mock            # start the mock patient portal at http://127.0.0.1:4300
npm run pw:ui           # Playwright UI mode
npm run cy:open         # Cypress interactive runner
npm run pw:report       # open the last Playwright HTML report
npm run typecheck       # TypeScript across both suites + shared engine
```

## Enable the AI features (optional)

```bash
cp .env.example .env
# set ANTHROPIC_API_KEY=... in .env (or export it)
```

With a key present:

- Self-healing emits **AI-suggested durable selectors** when a primary selector drifts.
- The data factory generates realistic **reason-for-visit** notes.
- The authoring CLI writes **full tests from plain English**:

```bash
node --experimental-strip-types shared/ai/nl-to-steps.ts --framework playwright \
  "Patient logs in and reschedules their cardiology appointment"
```

Without a key, all of the above fall back to deterministic behaviour and the suites stay green.

## How the AI pieces work

| Feature | Implementation | Docs |
|---|---|---|
| Self-healing locators | `shared/ai/self-healing.ts` + adapters | [docs/self-healing-locators.md](docs/self-healing-locators.md) |
| AI-assisted authoring | `shared/ai/nl-to-steps.ts` | [docs/ai-assisted-authoring.md](docs/ai-assisted-authoring.md) |
| Synthetic test data | `shared/data/patient-factory.ts` | — |
| Security checks | `shared/security/checks.ts` | [docs/security-testing.md](docs/security-testing.md) |
| Visual + a11y | `@axe-core/playwright`, `cypress-axe`, Playwright snapshots | — |

A single framework-agnostic engine in `shared/` powers **both** runners — see
[docs/architecture.md](docs/architecture.md).

## Project layout

```
mock-app/      Dependency-free Node patient portal (the system under test)
shared/        AI engine, data factories, security checks — used by both suites
playwright/    Page objects (self-healing), fixtures, specs
cypress/       Custom commands (self-healing), specs
docs/          Architecture + per-feature guides
.github/       CI: Playwright (chromium/firefox/webkit) + Cypress + typecheck
```

## ⚠️ Responsible use

This project is for **authorized testing only**. The suites default to the bundled synthetic
mock app and contain **no real patient data**. Point `BASE_URL` only at systems you own or are
explicitly authorized to test — never at production or third-party healthcare systems.

## Tech

Playwright · Cypress · TypeScript · axe-core · @faker-js/faker · Anthropic API (optional) · GitHub Actions

## License

[MIT](LICENSE)
