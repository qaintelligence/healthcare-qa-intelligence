# Security testing

Healthcare apps handle PHI, so the suites include a security baseline that runs on every CI
build. These are **regression guards**, not a substitute for a dedicated DAST scan or
professional penetration test.

## What is checked (`shared/security/checks.ts`)

| Check | What it verifies | Why it matters |
|---|---|---|
| Security headers | CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, HSTS | Clickjacking, MIME sniffing, referrer leakage, transport security |
| Session cookie flags | `HttpOnly` + `SameSite` on the session cookie | Blocks trivial XSS token theft and CSRF |
| No PHI in URL | MRN / member-id / SSN-like / tokens never appear in the URL | URLs land in logs, history, and referrers |
| No user enumeration | "unknown user" and "wrong password" return identical 401s | Prevents account discovery |
| Auth on protected APIs | Unauthenticated calls to data APIs return 401 | Broken-access-control (OWASP A01) |

Specs: `playwright/tests/security/security.spec.ts` and `cypress/e2e/security.cy.ts`.

## Scope & authorization

These checks run against the **bundled mock app** by default. Running them against any other
environment requires explicit authorization for that target. This repo is for **authorized**
testing only:

- ✅ Your own apps and staging environments you control.
- ✅ Environments you have written permission to test.
- ❌ Production systems, third-party systems, or anything you don't own or aren't authorized
  to assess.

## Extending

Add a new assertion to `shared/security/checks.ts` returning a `SecurityFinding`, then call
it from both suites. Good next additions: rate-limiting on login, password-policy
enforcement, CSP report-only validation, and TLS configuration checks.
