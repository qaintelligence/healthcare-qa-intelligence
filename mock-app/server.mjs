// Minimal, dependency-free mock "patient portal" used as the system under test.
// Models common healthcare workflows: login, appointments, prescription refills, insurance claims.
// NOTE: This is a synthetic demo app with fake data. It exists so the AI test suites
// run green out-of-the-box. Never point the suites at a real/production healthcare system.

import http from 'node:http';
import crypto from 'node:crypto';

const PORT = process.env.MOCK_PORT ? Number(process.env.MOCK_PORT) : 4300;
const HOST = '127.0.0.1';

// --- Demo credentials (synthetic) ---
const USER = { email: 'patient@example.com', password: 'Test1234!', name: 'Jordan Rivera', mrn: 'MRN-0001' };

// --- In-memory state (reset on restart) ---
const sessions = new Map(); // sid -> email
const db = freshDb();

function freshDb() {
  return {
    appointments: [
      { id: 'apt-1001', specialty: 'Cardiology', provider: 'Dr. Amara Okafor', date: '2026-07-02', time: '09:30', status: 'Confirmed' },
    ],
    prescriptions: [
      { id: 'rx-2001', name: 'Atorvastatin 20mg', refillsLeft: 2, status: 'Active' },
      { id: 'rx-2002', name: 'Lisinopril 10mg', refillsLeft: 0, status: 'Active' },
      { id: 'rx-2003', name: 'Metformin 500mg', refillsLeft: 5, status: 'Active' },
    ],
    claims: [
      { id: 'clm-3001', service: 'Annual physical', amount: 240.0, status: 'Paid' },
      { id: 'clm-3002', service: 'Lab work — lipid panel', amount: 89.5, status: 'Processing' },
    ],
  };
}

// --- Helpers ---
const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Cache-Control': 'no-store',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}
function json(res, status, obj, headers = {}) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json', ...headers });
}
function html(res, status, body, headers = {}) {
  send(res, status, body, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie ?? '').split(';').forEach((c) => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}
function currentUser(req) {
  const sid = parseCookies(req).sid;
  return sid && sessions.has(sid) ? USER : null;
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy(); // guard against oversized payloads
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Page layout ---
function layout(title, bodyHtml, user) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · MediPortal</title>
<link rel="stylesheet" href="/assets/app.css" />
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="topbar">
  <span class="brand" data-testid="brand">🏥 MediPortal</span>
  ${user ? `<nav aria-label="Primary"><a href="/dashboard">Dashboard</a><a href="/appointments">Appointments</a><a href="/prescriptions">Prescriptions</a><a href="/billing">Billing</a><button id="logout" data-testid="logout" class="linkbtn">Log out</button></nav>` : ''}
</header>
<main id="main" tabindex="-1">
${bodyHtml}
</main>
<script src="/assets/app.js"></script>
</body>
</html>`;
}

// --- Pages ---
function loginPage() {
  return layout(
    'Sign in',
    `<section class="card narrow" aria-labelledby="login-h">
  <h1 id="login-h">Patient sign in</h1>
  <p class="muted">Demo account: <code>patient@example.com</code> / <code>Test1234!</code></p>
  <form id="login-form" novalidate>
    <label for="email">Email address</label>
    <input id="email" name="email" type="email" autocomplete="username" data-testid="login-email" required />
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" data-testid="login-password" required />
    <p id="login-error" class="error" role="alert" data-testid="login-error" hidden></p>
    <button type="submit" data-testid="login-submit">Sign in</button>
  </form>
</section>`,
    null,
  );
}

function dashboardPage(user) {
  return layout(
    'Dashboard',
    `<section aria-labelledby="dash-h">
  <h1 id="dash-h" data-testid="welcome">Welcome back, ${escapeHtml(user.name)}</h1>
  <p class="muted">Medical record number: <span data-testid="mrn">${escapeHtml(user.mrn)}</span></p>
  <div class="grid">
    <a class="card stat" href="/appointments" data-testid="card-appointments"><span class="num">${db.appointments.length}</span>Upcoming appointments</a>
    <a class="card stat" href="/prescriptions" data-testid="card-prescriptions"><span class="num">${db.prescriptions.length}</span>Active prescriptions</a>
    <a class="card stat" href="/billing" data-testid="card-billing"><span class="num">${db.claims.length}</span>Insurance claims</a>
  </div>
</section>`,
    user,
  );
}

function appointmentsPage(user) {
  const rows = db.appointments
    .map(
      (a) =>
        `<tr data-testid="appt-row"><td>${escapeHtml(a.specialty)}</td><td>${escapeHtml(a.provider)}</td><td>${a.date} ${a.time}</td><td><span class="badge">${a.status}</span></td></tr>`,
    )
    .join('');
  return layout(
    'Appointments',
    `<section aria-labelledby="appt-h">
  <h1 id="appt-h">Appointments</h1>
  <table data-testid="appt-table"><caption class="sr-only">Your appointments</caption>
    <thead><tr><th>Specialty</th><th>Provider</th><th>When</th><th>Status</th></tr></thead>
    <tbody id="appt-body">${rows}</tbody>
  </table>
  <h2>Schedule a new appointment</h2>
  <form id="appt-form">
    <label for="specialty">Specialty</label>
    <select id="specialty" name="specialty" data-testid="appt-specialty" required>
      <option value="">Select…</option>
      <option>Cardiology</option><option>Dermatology</option><option>Primary Care</option><option>Endocrinology</option>
    </select>
    <label for="provider">Provider</label>
    <input id="provider" name="provider" data-testid="appt-provider" required />
    <label for="date">Date</label>
    <input id="date" name="date" type="date" data-testid="appt-date" required />
    <label for="time">Time</label>
    <input id="time" name="time" type="time" data-testid="appt-time" required />
    <label for="reason">Reason for visit</label>
    <textarea id="reason" name="reason" data-testid="appt-reason"></textarea>
    <button type="submit" data-testid="appt-submit">Book appointment</button>
  </form>
  <p id="appt-confirm" class="success" role="status" data-testid="appt-confirm" hidden></p>
</section>`,
    user,
  );
}

function prescriptionsPage(user) {
  const rows = db.prescriptions
    .map(
      (p) =>
        `<tr data-testid="rx-row" data-rx="${p.id}"><td>${escapeHtml(p.name)}</td><td data-testid="rx-refills">${p.refillsLeft}</td><td><span class="badge" data-testid="rx-status">${p.status}</span></td><td><button class="refill" data-testid="rx-refill" data-rx="${p.id}" ${p.refillsLeft === 0 ? 'disabled' : ''}>Request refill</button></td></tr>`,
    )
    .join('');
  return layout(
    'Prescriptions',
    `<section aria-labelledby="rx-h">
  <h1 id="rx-h">Prescriptions</h1>
  <table data-testid="rx-table"><caption class="sr-only">Your prescriptions</caption>
    <thead><tr><th>Medication</th><th>Refills left</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p id="rx-msg" class="success" role="status" data-testid="rx-msg" hidden></p>
</section>`,
    user,
  );
}

function billingPage(user) {
  const rows = db.claims
    .map(
      (c) =>
        `<tr data-testid="claim-row"><td>${c.id}</td><td>${escapeHtml(c.service)}</td><td>$${c.amount.toFixed(2)}</td><td><span class="badge" data-testid="claim-status">${c.status}</span></td></tr>`,
    )
    .join('');
  return layout(
    'Billing',
    `<section aria-labelledby="bill-h">
  <h1 id="bill-h">Insurance claims &amp; billing</h1>
  <table data-testid="claim-table"><caption class="sr-only">Your insurance claims</caption>
    <thead><tr><th>Claim</th><th>Service</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody id="claim-body">${rows}</tbody>
  </table>
  <h2>Submit a new claim</h2>
  <form id="claim-form">
    <label for="service">Service description</label>
    <input id="service" name="service" data-testid="claim-service" required />
    <label for="amount">Amount (USD)</label>
    <input id="amount" name="amount" type="number" step="0.01" min="0" data-testid="claim-amount" required />
    <button type="submit" data-testid="claim-submit">Submit claim</button>
  </form>
  <p id="claim-confirm" class="success" role="status" data-testid="claim-confirm" hidden></p>
</section>`,
    user,
  );
}

// --- Static assets ---
const CSS = `:root{--bg:#0f1720;--panel:#162232;--ink:#e7eef7;--muted:#9fb2c8;--accent:#2dd4bf;--err:#ff6b6b;--ok:#34d399}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink)}
.skip-link{position:absolute;left:-999px}.skip-link:focus{left:8px;top:8px;background:var(--accent);color:#04110f;padding:8px;border-radius:6px;z-index:10}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:14px 22px;background:var(--panel);border-bottom:1px solid #243449}
.brand{font-weight:700}nav a,.linkbtn{color:var(--ink);text-decoration:none;margin-left:16px;background:none;border:none;font:inherit;cursor:pointer}
nav a:hover,.linkbtn:hover{color:var(--accent)}
main{max-width:880px;margin:28px auto;padding:0 18px}
h1{margin-top:0}h2{margin-top:28px}
.card{background:var(--panel);border:1px solid #243449;border-radius:12px;padding:20px}
.narrow{max-width:380px;margin:8vh auto}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-top:18px}
.stat{display:flex;flex-direction:column;text-decoration:none;color:var(--ink)}.stat:hover{border-color:var(--accent)}
.stat .num{font-size:34px;font-weight:800;color:var(--accent)}
.muted{color:var(--muted)}code{background:#0b1220;padding:2px 6px;border-radius:5px}
label{display:block;margin:12px 0 4px;font-weight:600}
input,select,textarea{width:100%;padding:10px;border-radius:8px;border:1px solid #2c3e57;background:#0b1220;color:var(--ink);font:inherit}
button[type=submit],.refill{margin-top:16px;background:var(--accent);color:#04110f;border:none;border-radius:8px;padding:11px 18px;font-weight:700;cursor:pointer}
.refill{margin-top:0;padding:7px 12px}button:disabled{opacity:.45;cursor:not-allowed}
table{width:100%;border-collapse:collapse;margin-top:10px}th,td{text-align:left;padding:10px;border-bottom:1px solid #243449}
.badge{background:#0b1220;border:1px solid #2c3e57;border-radius:999px;padding:2px 10px;font-size:13px}
.error{color:var(--err)}.success{color:var(--ok)}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}`;

const JS = `(() => {
  async function api(url, body){
    const r = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
    let data={}; try{data=await r.json()}catch(_){}
    return {ok:r.ok,status:r.status,data};
  }
  function show(el,msg){ if(!el)return; el.textContent=msg; el.hidden=false; }
  const logout=document.querySelector('#logout');
  if(logout) logout.addEventListener('click', async ()=>{ await api('/api/logout'); location.href='/login'; });

  const login=document.querySelector('#login-form');
  if(login) login.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const err=document.querySelector('#login-error'); err.hidden=true;
    const {ok,data}=await api('/api/login',{email:email.value,password:password.value});
    if(ok){ location.href='/dashboard'; } else { show(err, data.error||'Sign in failed'); }
  });

  const appt=document.querySelector('#appt-form');
  if(appt) appt.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd=Object.fromEntries(new FormData(appt));
    const {ok,data}=await api('/api/appointments',fd);
    if(ok){
      const tb=document.querySelector('#appt-body');
      const tr=document.createElement('tr'); tr.setAttribute('data-testid','appt-row');
      tr.innerHTML='<td>'+fd.specialty+'</td><td>'+fd.provider+'</td><td>'+fd.date+' '+fd.time+'</td><td><span class="badge">Confirmed</span></td>';
      tb.appendChild(tr);
      show(document.querySelector('#appt-confirm'),'Appointment booked — confirmation '+data.confirmation);
      appt.reset();
    }
  });

  document.querySelectorAll('.refill').forEach(btn=>btn.addEventListener('click', async ()=>{
    const id=btn.getAttribute('data-rx');
    const {ok,data}=await api('/api/prescriptions/refill',{id});
    if(ok){
      const row=document.querySelector('tr[data-rx="'+id+'"]');
      row.querySelector('[data-testid=rx-status]').textContent='Refill requested';
      row.querySelector('[data-testid=rx-refills]').textContent=data.refillsLeft;
      btn.disabled=true;
      show(document.querySelector('#rx-msg'),'Refill requested for '+data.name);
    }
  }));

  const claim=document.querySelector('#claim-form');
  if(claim) claim.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fd=Object.fromEntries(new FormData(claim));
    const {ok,data}=await api('/api/claims',fd);
    if(ok){
      const tb=document.querySelector('#claim-body');
      const tr=document.createElement('tr'); tr.setAttribute('data-testid','claim-row');
      tr.innerHTML='<td>'+data.id+'</td><td>'+fd.service+'</td><td>$'+Number(fd.amount).toFixed(2)+'</td><td><span class="badge" data-testid="claim-status">Processing</span></td>';
      tb.appendChild(tr);
      show(document.querySelector('#claim-confirm'),'Claim submitted — '+data.id);
      claim.reset();
    }
  });
})();`;

// --- Router ---
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const user = currentUser(req);

  // Health check (used by Playwright webServer + CI readiness)
  if (path === '/health') return json(res, 200, { status: 'ok' });

  // Static assets
  if (path === '/assets/app.css') return send(res, 200, CSS, { 'Content-Type': 'text/css' });
  if (path === '/assets/app.js') return send(res, 200, JS, { 'Content-Type': 'text/javascript' });

  // API
  if (req.method === 'POST') {
    const body = await readBody(req);
    if (path === '/api/login') {
      // Constant-time-ish comparison; generic error message (no user enumeration).
      const ok = body.email === USER.email && body.password === USER.password;
      if (!ok) return json(res, 401, { error: 'Invalid email or password' });
      const sid = crypto.randomBytes(24).toString('hex');
      sessions.set(sid, USER.email);
      return json(res, 200, { ok: true }, { 'Set-Cookie': `sid=${sid}; HttpOnly; SameSite=Strict; Path=/` });
    }
    if (path === '/api/logout') {
      const sid = parseCookies(req).sid;
      sessions.delete(sid);
      return json(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0' });
    }
    // All other API routes require auth.
    if (!user) return json(res, 401, { error: 'Authentication required' });
    if (path === '/api/appointments') {
      if (!body.specialty || !body.date || !body.time) return json(res, 400, { error: 'Missing fields' });
      const id = 'apt-' + (1000 + db.appointments.length + 1);
      const confirmation = 'CNF-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      db.appointments.push({ id, specialty: body.specialty, provider: body.provider, date: body.date, time: body.time, status: 'Confirmed' });
      return json(res, 201, { ok: true, id, confirmation });
    }
    if (path === '/api/prescriptions/refill') {
      const rx = db.prescriptions.find((p) => p.id === body.id);
      if (!rx) return json(res, 404, { error: 'Prescription not found' });
      if (rx.refillsLeft === 0) return json(res, 409, { error: 'No refills remaining' });
      rx.refillsLeft -= 1;
      rx.status = 'Refill requested';
      return json(res, 200, { ok: true, name: rx.name, refillsLeft: rx.refillsLeft });
    }
    if (path === '/api/claims') {
      if (!body.service || !(Number(body.amount) >= 0)) return json(res, 400, { error: 'Invalid claim' });
      const id = 'clm-' + (3000 + db.claims.length + 1);
      db.claims.push({ id, service: body.service, amount: Number(body.amount), status: 'Processing' });
      return json(res, 201, { ok: true, id });
    }
    return json(res, 404, { error: 'Not found' });
  }

  // HTML routes
  if (path === '/' ) return html(res, 302, '', { Location: user ? '/dashboard' : '/login' });
  if (path === '/login') return html(res, 200, loginPage());

  // Auth-gated pages
  const gated = { '/dashboard': dashboardPage, '/appointments': appointmentsPage, '/prescriptions': prescriptionsPage, '/billing': billingPage };
  if (gated[path]) {
    if (!user) return html(res, 302, '', { Location: '/login' });
    return html(res, 200, gated[path](user));
  }

  return html(res, 404, layout('Not found', '<h1>404 — Page not found</h1>', user));
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`🏥 MediPortal mock app running at http://${HOST}:${PORT}`);
});
