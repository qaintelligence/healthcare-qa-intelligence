# healthcare-qa-intelligence

End-to-end test automation for healthcare patient-portal workflows, implemented in **both
Playwright and Cypress** from a shared, framework-agnostic engine — with self-healing
locators, accessibility/visual/security gates, synthetic test data, and an autonomous
Selenium agent.

![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)
![Cypress](https://img.shields.io/badge/Cypress-69D3A7?logo=cypress&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Selenium%20agent-Python-3776AB?logo=python&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

> Targets a **bundled synthetic mock portal** by default, so `npm install && npm run e2e` is
> green for anyone with no accounts and no real patient data. See
> [ADR 0001](docs/adr/0001-bundled-mock-as-system-under-test.md) for why.

## Why this project exists

Healthcare portals have workflows where correctness is not optional — booking the wrong slot,
mishandling a refill, or leaking an identifier into a URL are real harms. I wanted a
reference automation suite that (a) models those workflows, (b) demonstrates *how* I make a
UI suite fast and non-flaky rather than just that it passes, and (c) is fully runnable and
safe for anyone to clone. Real portals can't be used (unauthorized, non-reproducible), so the
suite runs against a small mock app I own — the transferable value is the framework and the
engineering decisions, documented in [ADRs](docs/adr).

## Modeled workflows

| Workflow | Coverage |
|---|---|
| Login / session | valid + invalid creds, protected-route redirects, logout |
| Appointment scheduling | booking with synthetic data, required-field validation |
| Prescription refills | request refill, status update, zero-refills guard |
| Insurance claims & billing | submit claim, processing status, seeded-state checks |

Cross-cutting on every screen: **accessibility** (axe-core, WCAG 2.1 AA), **visual
regression**, and a **security baseline** (headers, cookie hardening, no-PHI-in-URL,
anti-enumeration, access control).

|  |  |
|---|---|
| ![Login](docs/screenshots/login.png) | ![Dashboard](docs/screenshots/dashboard.png) |

## Architecture

One framework-agnostic engine in `shared/`, bound to each runner through a thin adapter
([ADR 0002](docs/adr/0002-two-runners-one-shared-engine.md)). Write the logic once; run it in
both Playwright and Cypress.

```mermaid
flowchart TD
    subgraph SUT["mock-app/  (system under test)"]
      MA["Node patient portal<br/>auth · appts · rx · claims<br/>security headers · a11y markup"]
    end

    subgraph SHARED["shared/  (framework-agnostic engine)"]
      SH["ai/self-healing.ts<br/>resolveSelector(spec, probe)"]
      AI["ai/ai-client.ts + nl-to-steps.ts"]
      DF["data/patient-factory.ts<br/>(faker, seeded)"]
      SEC["security/checks.ts"]
    end

    subgraph PW["playwright/"]
      PWP["PortalPage.smart()<br/>page.locator probe"]
      PWT["specs: auth · appts · rx · billing<br/>a11y · visual · security"]
    end

    subgraph CY["cypress/"]
      CYC["cy.smartGet()<br/>Cypress.$ probe"]
      CYT["specs: auth · appts · rx · billing<br/>a11y · security"]
    end

    AGENT["selenium-agent/ (Python)<br/>perceive → decide(Claude) → act loop"]

    SH --> PWP & CYC
    DF --> PWT & CYT
    SEC --> PWT & CYT
    AI --> SH
    PWP --> PWT --> SUT
    CYC --> CYT --> SUT
    AGENT --> SUT
```

## Key engineering decisions

The non-obvious choices, with full context and rejected alternatives in
[`docs/adr/`](docs/adr):

| Decision | Tradeoff accepted |
|---|---|
| [Bundled mock as the SUT](docs/adr/0001-bundled-mock-as-system-under-test.md) | Runnable + safe, but not proof of testing a complex production app |
| [Two runners, one engine](docs/adr/0002-two-runners-one-shared-engine.md) | More indirection, but no duplicated logic and broader coverage |
| [Self-heal on existence, not visibility](docs/adr/0003-self-healing-resolves-on-existence.md) | `smart()` returns possibly-hidden elements; caller asserts visibility (fixed a real race) |
| [AI optional, degrades gracefully](docs/adr/0004-ai-features-degrade-gracefully.md) | Full AI only visible with a key, but CI stays deterministic and free |
| [Entity-scoped assertions](docs/adr/0005-test-isolation-via-entity-scoped-assertions.md) | Discipline required, but parallel-safe on shared mock state |
| [Agent same-origin + step cap](docs/adr/0006-agent-safety-guards.md) | Blocks cross-domain flows, but the agent can't wander or loop forever |

See also: **[Test strategy](docs/test-strategy.md)** · **[Known limitations](docs/known-limitations.md)** · **[Roadmap](ROADMAP.md)** · **[Changelog](CHANGELOG.md)** (incl. the real bugs fixed while building this).

## Quick start

```bash
npm install
npx playwright install        # browsers (first time)
npm run e2e                   # Playwright + Cypress (auto-boots the mock app)

# or individually:
npm run e2e:pw                # Playwright only
npm run e2e:cy                # Cypress only
npm run mock                  # just the mock portal at http://127.0.0.1:4300
npm run typecheck
```

Run in containers instead: `docker compose up --build --abort-on-container-exit`
(see [docs/deployment.md](docs/deployment.md)).

## AI features (and their honest scope)

All of these **degrade to deterministic behaviour without an `ANTHROPIC_API_KEY`**, so they
never make the build flaky ([ADR 0004](docs/adr/0004-ai-features-degrade-gracefully.md)):

- **Self-healing locators** — declare intent + ordered fallback selectors; drift is *healed
  and logged* instead of failing the suite. With a key, each heal also gets an AI-suggested
  durable selector. The login button uses a deliberately-stale primary selector so you can
  watch it heal. ([docs](docs/self-healing-locators.md))
- **Synthetic test data** — seeded faker factories; optional LLM-generated reason-for-visit.
- **NL-to-test authoring CLI** — `shared/ai/nl-to-steps.ts` turns a sentence into a test
  draft. *Deliberately a thin wrapper* — the value is the conventions it feeds the model
  (noted in [known limitations](docs/known-limitations.md)).

## Autonomous Selenium agent

[`selenium-agent/`](selenium-agent) is a Python agent that drives the browser via a
**perceive → decide → act** loop: it observes interactive elements, asks Claude for the next
action, executes it with Selenium, and repeats until the goal is met — with same-origin and
max-step guards ([ADR 0006](docs/adr/0006-agent-safety-guards.md)) and a heuristic fallback
that runs without a key.

```bash
npm run mock &        # portal on :4300
cd selenium-agent && pip install -r requirements.txt
python agent.py "log in and request a prescription refill"
```

## Project layout

```
mock-app/        Dependency-free Node patient portal (system under test) + Dockerfile
shared/          AI engine, data factories, security checks — used by both suites
playwright/      Page objects (self-healing), fixtures, specs
cypress/         Custom commands (self-healing), specs
selenium-agent/  Autonomous Selenium AI agent loop (Python)
docs/            ADRs, test strategy, deployment, limitations, screenshots, CI example
```

## Responsible use

Authorized testing only. Defaults to the bundled synthetic mock — no real PHI. Point
`BASE_URL` / the agent's `--url` only at systems you own or are authorized to test, never
production or third-party healthcare systems. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
