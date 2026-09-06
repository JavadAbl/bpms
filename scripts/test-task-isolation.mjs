#!/usr/bin/env node
/* API-level task/instance isolation tests for the کارتابل privacy change.
 * Expected: users see only their own tasks; instance access requires
 * participation (starter / task assignee / held unclaimed position task);
 * terminate is starter/admin only; findAll is admin only.
 */
const BASE = 'http://127.0.0.1:3001/api';

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  const body = await res.json();
  return { token: body.accessToken, userId: body.userId, email, role: body.role };
}

async function call(method, path, auth) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} — ${detail}`); }
}

(async () => {
  const admin = await login('admin@bpms.local', 'admin123');
  const john = await login('john@bpms.local', 'user123');
  const jane = await login('jane@bpms.local', 'user123');

  // --- fixtures -------------------------------------------------------------
  const johnMine = (await call('GET', '/tasks/mine', john)).body;
  const janeMine = (await call('GET', '/tasks/mine', jane)).body;
  const johnOwnTask = johnMine.find((t) => t.assigneeId === john.userId) ?? johnMine[0];
  const janeTask = janeMine.find((t) => t.assigneeId === jane.userId) ?? janeMine[0];

  // Fresh running instance started by jane (leave process, first task → john):
  // bob is the true non-participant; john is a legit participant via the first task.
  const procs = (await call('GET', '/processes', admin)).body.filter((p) => p.status === 'ACTIVE');
  const proc = procs.find((p) => p.name.includes('مرخصی')) ?? procs[0];
  const started = await call('POST', '/process-instances', jane);
  // start via raw POST with body:
  const startRes = await fetch(`${BASE}/process-instances`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jane.token}` },
    body: JSON.stringify({ processId: proc.id }),
  });
  const freshInst = await startRes.json();
  const bob = await login('bob@bpms.local', 'user123');

  console.log(`fixtures: john ${johnMine.length} mine, jane ${janeMine.length} mine; fresh jane instance ${freshInst.id?.slice(0, 8)}`);

  console.log('\n[1] GET /tasks (findAll) — admin only');
  check('admin → 200', (await call('GET', '/tasks', admin)).status === 200, 'expected 200');
  check('john → 403', (await call('GET', '/tasks', john)).status === 403, 'expected 403');
  check('jane → 403', (await call('GET', '/tasks', jane)).status === 403, 'expected 403');

  console.log('\n[2] GET /tasks/:id — کارتابل visibility only');
  check('john own task → 200', (await call('GET', `/tasks/${johnOwnTask.id}`, john)).status === 200, 'expected 200');
  check('admin any task → 200', (await call('GET', `/tasks/${johnOwnTask.id}`, admin)).status === 200, 'expected 200');
  const johnOnJane = await call('GET', `/tasks/${janeTask.id}`, john);
  check('john on jane task → 403', johnOnJane.status === 403, `got ${johnOnJane.status}`);
  const janeOnJohn = await call('GET', `/tasks/${johnOwnTask.id}`, jane);
  check('jane on john task → 403', janeOnJohn.status === 403, `got ${janeOnJohn.status}`);

  console.log('\n[3] GET /process-instances/:id — participant check');
  check('jane starter on own instance → 200', (await call('GET', `/process-instances/${freshInst.id}`, jane)).status === 200, 'expected 200');
  check('john (first-task assignee) → 200', (await call('GET', `/process-instances/${freshInst.id}`, john)).status === 200, 'expected 200 (participant)');
  check('bob (non-participant) → 403', (await call('GET', `/process-instances/${freshInst.id}`, bob)).status === 403, 'expected 403');
  check('admin → 200', (await call('GET', `/process-instances/${freshInst.id}`, admin)).status === 200, 'expected 200');

  console.log('\n[4] POST /process-instances/:id/terminate — starter/admin only');
  check('bob (non-starter) terminate → 403', (await call('POST', `/process-instances/${freshInst.id}/terminate`, bob)).status === 403, 'expected 403');
  const term = await call('POST', `/process-instances/${freshInst.id}/terminate`, jane);
  check('jane (starter) terminate own → 2xx', term.status >= 200 && term.status < 300, `got ${term.status}`);

  console.log('\n[5] /tasks/mine + /tasks/mine-based report fallback still healthy');
  check('john mine → 200', (await call('GET', '/tasks/mine', john)).status === 200, 'expected 200');
  check('john /process-instances → 403 (admin-only report)', (await call('GET', '/process-instances', john)).status === 403, 'expected 403');
  check('john /process-instances/mine → 200', (await call('GET', '/process-instances/mine', john)).status === 200, 'expected 200');

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
