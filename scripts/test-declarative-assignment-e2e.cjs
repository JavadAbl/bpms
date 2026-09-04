/**
 * E2E test — declarative relative assignment (no triggers):
 *   INITIATOR         → task goes to whoever started the instance
 *   INITIATOR_MANAGER → task goes to the manager (isManager position) of the
 *                       initiator's department, resolved at task-creation time
 *   POSITION          → task goes to the position pool (HR manager = bob)
 *   fallback          → initiator without any position/manager → first ADMIN
 *
 * Org structure (Persian seed):
 *   john (کارشناس فنی، مهندسی)  → manager = jane (مدیر مهندسی، isManager)
 *   bob  (مدیر منابع انسانی، isManager)
 *   admin — holds NO position (tests fallback)
 */
const API = 'http://localhost:3001/api';

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  return (await res.json()).accessToken;
}

async function api(token, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${options.method || 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`);
  return body;
}

const asList = (d) => (Array.isArray(d) ? d : d.items || d.data || []);

async function waitForTask(token, predicate, label, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    const hit = asList(await api(token, '/tasks/mine')).find(predicate);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`task not found within timeout: ${label}`);
}

let failures = 0;
function check(ok, label, detail) {
  console.log(`${ok ? '✓ PASS' : '✗ FAIL'} ${label} — ${detail}`);
  if (!ok) failures++;
}

(async () => {
  const [john, jane, bob, admin] = await Promise.all([
    login('john@bpms.local', 'user123'),
    login('jane@bpms.local', 'user123'),
    login('bob@bpms.local', 'user123'),
    login('admin@bpms.local', 'admin123'),
  ]);

  const proc = asList(await api(john, '/processes')).find((p) => p.name === 'فرآیند درخواست مرخصی');
  if (!proc) throw new Error('Persian process not found');

  const submitForm = { employeeName: 'علی رضایی', startDate: '2026-09-10', endDate: '2026-09-12', reason: 'تست' };

  // -----------------------------------------------------------------------
  // KEY TEST: john (کارشناس مهندسی) starts → manager approval must go to
  // JANE dynamically (INITIATOR_MANAGER) — jane is NOT hardcoded anywhere.
  // -----------------------------------------------------------------------
  {
    const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
    const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'submit(john)');
    check(submit.assignee?.email === 'john@bpms.local', 'INITIATOR', 'submit task assigned to the instance starter (john)');
    await api(john, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Annual' } }) });
    const approve = await waitForTask(jane, (t) => t.name === 'تایید مدیر مستقیم' && t.processInstanceId === inst.id, 'manager(jane)');
    check(!!approve, 'INITIATOR_MANAGER', `john's request routed to jane (مدیر مهندسی) dynamically — not hardcoded`);
    await api(jane, `/tasks/${approve.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { decision: 'تایید' } }) });
    const notify = await waitForTask(john, (t) => t.name === 'اطلاع‌رسانی نتیجه' && t.processInstanceId === inst.id, 'notify(john)');
    check(!!notify, 'INITIATOR (notify)', 'notification task returned to the initiator (john)');
    await api(john, `/tasks/${notify.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { notifyMethod: 'ایمیل' } }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await api(john, `/process-instances/${inst.id}`);
    check(after.status === 'COMPLETED', 'annual full path', `instance status=${after.status}`);
  }

  // -----------------------------------------------------------------------
  // Sick → auto-approve (unchanged behavior)
  // -----------------------------------------------------------------------
  {
    const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
    const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'submit(john)');
    await api(john, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Sick' } }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await api(john, `/process-instances/${inst.id}`);
    const janeTasks = asList(await api(jane, '/tasks/mine')).filter((t) => t.processInstanceId === inst.id);
    check(after.status === 'COMPLETED' && janeTasks.length === 0, 'sick auto-approve', `status=${after.status}, jane tasks=${janeTasks.length}`);
  }

  // -----------------------------------------------------------------------
  // Unpaid → POSITION pool (مدیر منابع انسانی = bob)
  // -----------------------------------------------------------------------
  {
    const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
    const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'submit(john)');
    await api(john, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Unpaid' } }) });
    const approve = await waitForTask(bob, (t) => t.name === 'تایید منابع انسانی' && t.processInstanceId === inst.id, 'hr(bob)');
    check(!!approve, 'POSITION', `unpaid request routed to the HR manager position (bob)`);
    await api(bob, `/tasks/${approve.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { decision: 'رد' } }) });
    const notify = await waitForTask(john, (t) => t.name === 'اطلاع‌رسانی نتیجه' && t.processInstanceId === inst.id, 'notify(john)');
    await api(john, `/tasks/${notify.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { notifyMethod: 'پیامک' } }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await api(john, `/process-instances/${inst.id}`);
    check(after.status === 'COMPLETED', 'unpaid full path', `instance status=${after.status}`);
  }

  // -----------------------------------------------------------------------
  // FALLBACK: admin has NO position → no department → no manager.
  // INITIATOR_MANAGER must fall back to the first ADMIN (admin themself).
  // -----------------------------------------------------------------------
  {
    const inst = await api(admin, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
    const submit = await waitForTask(admin, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'submit(admin)');
    await api(admin, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Annual' } }) });
    const approve = await waitForTask(admin, (t) => t.name === 'تایید مدیر مستقیم' && t.processInstanceId === inst.id, 'fallback(admin)');
    check(!!approve, 'no-manager fallback', 'initiator without department → approval fell back to first ADMIN');
    await api(admin, `/tasks/${approve.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { decision: 'تایید' } }) });
    const notify = await waitForTask(admin, (t) => t.name === 'اطلاع‌رسانی نتیجه' && t.processInstanceId === inst.id, 'notify(admin)');
    await api(admin, `/tasks/${notify.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { notifyMethod: 'ایمیل' } }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await api(admin, `/process-instances/${inst.id}`);
    check(after.status === 'COMPLETED', 'fallback full path', `instance status=${after.status}`);
  }

  console.log(failures === 0 ? '\n🎉 ALL DECLARATIVE-ASSIGNMENT E2E TESTS PASSED' : `\n💥 ${failures} test(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
