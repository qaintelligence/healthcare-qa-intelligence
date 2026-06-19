/**
 * Reusable, framework-agnostic security assertions for healthcare web apps.
 *
 * These encode baseline expectations that matter especially for systems handling PHI:
 * security headers, hardened session cookies, no protected data leaking into URLs,
 * and login responses that don't enable user enumeration. Each function returns a
 * structured result so Playwright and Cypress can assert on it however they prefer.
 */

export interface SecurityFinding {
  check: string;
  passed: boolean;
  detail: string;
}

const REQUIRED_HEADERS: Record<string, (v: string | null) => boolean> = {
  'content-security-policy': (v) => !!v && v.includes("default-src"),
  'x-content-type-options': (v) => v?.toLowerCase() === 'nosniff',
  'x-frame-options': (v) => !!v && /deny|sameorigin/i.test(v),
  'referrer-policy': (v) => !!v,
  'strict-transport-security': (v) => !!v && /max-age=\d+/.test(v),
};

/** Validate the standard set of security response headers. */
export function checkSecurityHeaders(headers: Record<string, string | undefined>): SecurityFinding[] {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) if (v != null) lower[k.toLowerCase()] = v;
  return Object.entries(REQUIRED_HEADERS).map(([name, ok]) => {
    const value = lower[name] ?? null;
    return {
      check: `header:${name}`,
      passed: ok(value),
      detail: value ? `present: ${value.slice(0, 80)}` : 'missing',
    };
  });
}

/** Session cookies must be HttpOnly and SameSite, ruling out trivial XSS theft/CSRF. */
export function checkSessionCookie(setCookie: string | string[] | undefined): SecurityFinding {
  const raw = Array.isArray(setCookie) ? setCookie.join('; ') : setCookie ?? '';
  const cookie = raw.split(',').find((c) => /sid=/.test(c)) ?? raw;
  const httpOnly = /httponly/i.test(cookie);
  const sameSite = /samesite=(strict|lax)/i.test(cookie);
  return {
    check: 'session-cookie-flags',
    passed: httpOnly && sameSite,
    detail: `HttpOnly=${httpOnly}, SameSite=${sameSite}`,
  };
}

/** Protected identifiers (MRN, member id, SSN-like, tokens) must never appear in a URL. */
export function checkNoPhiInUrl(url: string): SecurityFinding {
  const patterns: Array<[string, RegExp]> = [
    ['mrn', /mrn-?\d/i],
    ['member-id', /mbr-?[a-z0-9]/i],
    ['ssn-like', /\b\d{3}-\d{2}-\d{4}\b/],
    ['token-in-url', /[?&](token|sid|password|pwd)=/i],
  ];
  const hit = patterns.find(([, re]) => re.test(url));
  return {
    check: 'no-phi-in-url',
    passed: !hit,
    detail: hit ? `leaked ${hit[0]} in URL` : 'clean',
  };
}

/**
 * Login should fail closed and identically for "unknown user" vs "wrong password"
 * (no user enumeration). Caller passes both responses.
 */
export function checkNoUserEnumeration(unknownUser: { status: number; body: string }, wrongPassword: { status: number; body: string }): SecurityFinding {
  const sameStatus = unknownUser.status === wrongPassword.status;
  const sameBody = unknownUser.body.trim() === wrongPassword.body.trim();
  return {
    check: 'no-user-enumeration',
    passed: sameStatus && sameBody && unknownUser.status === 401,
    detail: `status ${unknownUser.status}/${wrongPassword.status}, identical message: ${sameBody}`,
  };
}

export function allPassed(findings: SecurityFinding[]): boolean {
  return findings.every((f) => f.passed);
}
