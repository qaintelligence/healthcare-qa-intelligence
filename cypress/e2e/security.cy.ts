/// <reference types="cypress" />
import { checkSecurityHeaders, checkSessionCookie, checkNoPhiInUrl } from '../../shared/security/checks.ts';

describe('Security baseline', () => {
  it('sets the required security headers', () => {
    cy.request('/login').then((res) => {
      const findings = checkSecurityHeaders(res.headers as Record<string, string>);
      const failed = findings.filter((f) => !f.passed);
      expect(failed, JSON.stringify(failed)).to.have.length(0);
    });
  });

  it('issues a hardened session cookie on login', () => {
    cy.request('POST', '/api/login', { email: 'patient@example.com', password: 'Test1234!' }).then((res) => {
      const finding = checkSessionCookie(res.headers['set-cookie'] as string[] | undefined);
      expect(finding.passed, finding.detail).to.eq(true);
    });
  });

  it('does not allow user enumeration', () => {
    const post = (body: object) =>
      cy.request({ method: 'POST', url: '/api/login', body, failOnStatusCode: false });
    post({ email: 'nobody@example.com', password: 'x' }).then((unknown) => {
      post({ email: 'patient@example.com', password: 'x' }).then((wrongPw) => {
        expect(unknown.status).to.eq(wrongPw.status);
        expect(JSON.stringify(unknown.body)).to.eq(JSON.stringify(wrongPw.body));
      });
    });
  });

  it('rejects unauthenticated access to protected APIs', () => {
    cy.request({ method: 'POST', url: '/api/claims', body: { service: 'x', amount: 1 }, failOnStatusCode: false }).then(
      (res) => expect(res.status).to.eq(401),
    );
  });

  it('keeps PHI out of the URL', () => {
    cy.login();
    cy.visit('/billing');
    cy.location('href').then((href) => {
      expect(checkNoPhiInUrl(href).passed).to.eq(true);
    });
  });
});
