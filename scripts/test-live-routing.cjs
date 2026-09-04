/**
 * LIVE routing test: drives the real API through the Next.js proxy (:3000)
 * to verify gateway condition routing end-to-end (engine + DB + tasks).
 *
 * Scenario (Leave Approval):
 *   Start → Submit Request → DecisionGateway
 *     - leaveType === 'Sick'   → Auto-Approved end   (instance completes, no 2nd task)
 *     - leaveType !== 'Sick'   → "Approve Request" task (2nd task created)
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000/api';

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

async function waitFor(condFn, { tries = 30, delayMs = 200, label = 'condition' } = {}) {
  for (let i = 0; i < tries; i++) {
    const v = await condFn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Timeout waiting for ${label}`);
}

async function runCase(token, process, leaveType) {
  // 1. Start instance
  const inst = await api('POST', '/process-instances', { processId: process.id }, token);
  const instanceId = inst.id;

  // 2. Wait for the first task (Submit Request)
  const withTask = await waitFor(
    async () => {
      const cur = await api('GET', `/process-instances/${instanceId}`, null, token);
      const t = (cur.tasks || []).find((x) => x.status === 'PENDING');
      return t ? cur : null;
    },
    { label: `first PENDING task for ${leaveType}` },
  );
  const submitTask = withTask.tasks.find((x) => x.status === 'PENDING');

  // 3. Complete it with the leave type
  await api('POST', `/tasks/${submitTask.id}/complete`, { data: { leaveType } }, token);

  // 4. Wait for the gateway decision to materialize
  const after = await waitFor(
    async () => {
      const cur = await api('GET', `/process-instances/${instanceId}`, null, token);
      const done = cur.status !== 'RUNNING';
      const pending = (cur.tasks || []).filter((x) => x.status === 'PENDING');
      if (done || pending.length > 0) return cur;
      return null;
    },
    { label: `gateway decision for ${leaveType}` },
  );

  const pendingNames = (after.tasks || [])
    .filter((x) => x.status === 'PENDING')
    .map((x) => x.name);
  return { instanceId, status: after.status, pendingNames, tasks: after.tasks.map((t) => `${t.name}:${t.status}`) };
}

(async () => {
  console.log('=== LIVE Gateway Routing Test ===');
  // 'Submit Request' is directly assigned to john (seed.ts line ~291)
  const login = await api('POST', '/auth/login', {
    email: 'john@bpms.local',
    password: 'user123',
  });
  const token = login.access_token || login.token || login.accessToken;
  if (!token) throw new Error(`No token in login response: ${JSON.stringify(login).slice(0, 200)}`);
  console.log('✔ logged in as john (employee, assigned to Submit Request)');

  const processes = await api('GET', '/processes', null, token);
  const leave = processes.find((p) => p.name === 'Leave Approval');
  if (!leave) throw new Error('Leave Approval process not found');
  console.log(`✔ found process: ${leave.name} (status=${leave.status}, v${leave.version})`);
  if (leave.status !== 'ACTIVE') throw new Error('Process is not ACTIVE — cannot start instances');

  const cases = [
    { leaveType: 'Sick', expect: { status: 'COMPLETED', tasks: [] } },
    { leaveType: 'Annual', expect: { status: 'RUNNING', tasks: ['Approve Request'] } },
    { leaveType: 'Unpaid', expect: { status: 'RUNNING', tasks: ['Approve Request'] } },
  ];

  let pass = 0;
  for (const c of cases) {
    console.log(`\n--- leaveType = ${c.leaveType} ---`);
    try {
      const r = await runCase(token, leave, c.leaveType);
      console.log(`instance ${r.instanceId}: status=${r.status}, pending=[${r.pendingNames.join(', ')}]`);
      console.log(`tasks: ${r.tasks.join(' | ')}`);

      const statusOk = r.status === c.expect.status;
      const tasksOk =
        c.expect.tasks.length === r.pendingNames.length &&
        c.expect.tasks.every((n) => r.pendingNames.includes(n));
      const ok = statusOk && tasksOk;
      console.log(
        ok
          ? `✔ PASS — ${c.leaveType} routed to ${r.status === 'COMPLETED' ? 'Auto-Approved (no manual approval needed)' : `"${r.pendingNames.join(',')}"`}`
          : `✘ FAIL — expected status=${c.expect.status} pending=[${c.expect.tasks.join(',')}]`,
      );
      if (ok) pass++;
    } catch (e) {
      console.log(`✘ FAIL — ${e.message}`);
    }
  }

  console.log(`\n=== RESULT: ${pass}/${cases.length} cases passed ===`);
  process.exit(pass === cases.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
