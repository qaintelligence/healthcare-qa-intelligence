import { test, expect } from '../../fixtures/test-fixtures.ts';
import {
  checkSecurityHeaders,
  checkSessionCookie,
  checkNoPhiInUrl,
  checkNoUserEnumeration,
  allPassed,
} from '../../../shared/security/checks.ts';

/**
 * Baseline security checks tuned for PHI-handling apps. These complement (not replace)
 * a dedicated DAST/pentest — they catch regressions in headers, cookie hardening,
 * data-in-URL leakage, and login enumeration on every CI run.
 */
test.describe('Security baseline', () => {
  test('responses set the required security headers', async ({ request }) => {
    const res = await request.get('/login');
    const findings = checkSecurityHeaders(res.headers());
    expect(findings.filter((f) => !f.passed), JSON.stringify(findings, null, 2)).toEqual([]);
  });

  test('session cookie is HttpOnly + SameSite', async ({ request }) => {
    const res = await request.post('/api/login', {
      data: { email: 'patient@example.com', password: 'Test1234!' },
    });
    const finding = checkSessionCookie(res.headers()['set-cookie']);
    expect(finding.passed, finding.detail).toBe(true);
  });

  test('no PHI / secrets leak into the URL after navigating the portal', async ({ portal, page }) => {
    await portal.login();
    await page.goto('/billing');
    const finding = checkNoPhiInUrl(page.url());
    expect(finding.passed, finding.detail).toBe(true);
  });

  test('login does not allow user enumeration', async ({ request }) => {
    const unknown = await request.post('/api/login', { data: { email: 'nobody@example.com', password: 'x' } });
    const wrongPw = await request.post('/api/login', { data: { email: 'patient@example.com', password: 'x' } });
    const finding = checkNoUserEnumeration(
      { status: unknown.status(), body: await unknown.text() },
      { status: wrongPw.status(), body: await wrongPw.text() },
    );
    expect(finding.passed, finding.detail).toBe(true);
  });

  test('protected API rejects unauthenticated access', async ({ request }) => {
    const res = await request.post('/api/claims', { data: { service: 'x', amount: 1 } });
    expect(res.status()).toBe(401);
  });

  test('aggregate security posture passes', async ({ request }) => {
    const res = await request.get('/login');
    expect(allPassed(checkSecurityHeaders(res.headers()))).toBe(true);
  });
});
