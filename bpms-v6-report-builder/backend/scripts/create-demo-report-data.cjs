#!/usr/bin/env node
/**
 * Creates ONE realistic completed leave instance on the seeded process so the
 * گزارش‌ساز (report builder) shows meaningful data on first open.
 *
 * Flow: admin starts the instance → john submits an Annual leave request for
 * «علی رضایی» → jane (manager) approves → john sends the notification →
 * instance ends COMPLETED. Leaves zero extra reports behind.
 */
const BASE = process.env.BPMS_BASE || 'http://localhost:3001/api';

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return res.json();
}

async function api(token, path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  let body = null;
  try { body = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function pendingTask(token, processId, name) {
  for (let i = 0; i < 10; i++) {
    const mine = await api(token, '/tasks/mine');
    const hit = (mine || []).find(
      (t) => t.name === name && t.processInstance?.process?.id === processId,
    );
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`task never appeared: ${name}`);
}

async function main() {
  const admin = await login('admin@bpms.local', 'admin123');
  const john = await login('john@bpms.local', 'user123');
  const jane = await login('jane@bpms.local', 'user123');

  const processes = await api(admin.accessToken, '/processes');
  const proc = processes.find((p) => p.name === 'فرآیند درخواست مرخصی');
  if (!proc) throw new Error('seeded process not found — run the seed first');

  await api(admin.accessToken, '/process-instances', {
    method: 'POST',
    body: JSON.stringify({ processId: proc.id }),
  });

  const submit = await pendingTask(john.accessToken, proc.id, 'ثبت درخواست مرخصی');
  await api(john.accessToken, `/tasks/${submit.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        employeeName: 'علی رضایی',
        leaveType: 'Annual',
        startDate: '2026-09-15',
        endDate: '2026-09-20',
        reason: 'سفر خانوادگی',
      },
    }),
  });

  const approval = await pendingTask(jane.accessToken, proc.id, 'تایید مدیر مستقیم');
  await api(jane.accessToken, `/tasks/${approval.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ data: { decision: 'تایید', comment: 'موافق — با توفیق' } }),
  });

  const notify = await pendingTask(john.accessToken, proc.id, 'اطلاع‌رسانی نتیجه');
  await api(john.accessToken, `/tasks/${notify.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ data: { notifyMethod: 'ایمیل', notifyNote: 'ارسال شد' } }),
  });

  console.log('✅ Demo leave instance completed (علی رضایی — Annual — تایید).');
}

main().catch((e) => {
  console.error('Demo data script failed:', e.message);
  process.exit(1);
});
