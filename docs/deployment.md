# Deployment & production considerations

This is a test-automation project, so "deployment" means two things: running the **suite**
reliably in CI/containers, and (optionally) hosting the **mock app** as a live demo.

## Run everything in Docker

```bash
docker compose up --build --abort-on-container-exit
```

`app` serves the mock portal with a `/health`-based healthcheck; `playwright` waits for it to
be healthy, then runs the suite against `http://app:4300`. The same `Dockerfile` is what
you'd deploy if you wanted the mock app reachable as a live demo (any container host:
Fly.io, Render, Cloud Run, ECS).

## CI

A ready-to-enable pipeline lives at `docs/ci-workflow.example.yml`:

- **Playwright** matrix across chromium / firefox / webkit
- **Cypress** (boots the mock app via `start-server-and-test`)
- **typecheck**
- Uploads HTML reports / failure screenshots as artifacts

Enable it by moving it to `.github/workflows/ci.yml` (requires the `workflow` token scope).

## Production considerations (if this targeted a real portal)

The mock app is intentionally minimal; here's what would change for a real deployment, to
show the considerations are understood:

- **Configuration** — `BASE_URL`, credentials, and data setup/teardown injected per
  environment; no secrets in the repo (already: `.env` is gitignored, `.env.example`
  documents shape).
- **Test data** — provision per-run synthetic patients against a seed/teardown API rather
  than relying on shared seeded state (removes the constraint behind ADR 0005).
- **Parallelism & sharding** — shard specs across CI runners; isolate data per worker.
- **Flake budget** — quarantine lane for newly flaky specs; track flake rate over time.
- **Observability** — publish trends and HTML reports (GitHub Pages), alert on suite
  regressions.
- **Secrets** — pull `ANTHROPIC_API_KEY` and portal creds from the CI secret store, never
  the environment of a forked PR.

## Performance & security notes

- **Performance:** the suite avoids fixed sleeps (web-first waits only); the mock app sends
  `Cache-Control: no-store` so tests never read stale responses. Load testing is a separate
  track (see roadmap).
- **Security:** every response sets CSP / `X-Frame-Options` / `nosniff` / HSTS; session
  cookies are `HttpOnly; SameSite=Strict`; the agent is same-origin-bounded. These are
  asserted by the security specs, not just claimed.
