/**
 * E2E test for the Persian seeded process «فرآیند درخواست مرخصی».
 *
 * Runs the REAL backend API (proxy-free, direct :3001) through three scenarios:
 *   1) leaveType=Sick   → «ثبت درخواست مرخصی» → XOR gateway → auto-approve END (instance COMPLETED, no approval tasks)
 *   2) leaveType=Annual → submit → jane gets «تایید مدیر مستقیم» → complete → john gets «اطلاع‌رسانی نتیجه» → complete → COMPLETED
 *   3) leaveType=Unpaid → submit → bob  gets «تایید منابع انسانی» → complete → john gets «اطلاع‌رسانی نتیجه» → complete → COMPLETED
 */
const API = 'http://localhost:3001/api';

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
  const body = await res.json();
  return body.accessToken;
}

async function api(token, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
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
    const tasks = asList(await api(token, '/tasks/mine'));
    const hit = tasks.find(predicate);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`task not found within timeout: ${label}`);
}

async function getInstance(token, id) {
  return api(token, `/process-instances/${id}`);
}

(async () => {
  const [john, jane, bob] = await Promise.all([
    login('john@bpms.local', 'user123'),
    login('jane@bpms.local', 'user123'),
    login('bob@bpms.local', 'user123'),
  ]);
  console.log('✓ logged in as john / jane / bob');

  const processes = asList(await api(john, '/processes'));
  const proc = processes.find((p) => p.name === 'فرآیند درخواست مرخصی');
  if (!proc) throw new Error('Persian process not found: فرآیند درخواست مرخصی');
  console.log(`✓ found process «${proc.name}» (${proc.id})`);

  const submitForm = { employeeName: 'علی رضایی', startDate: '2026-09-10', endDate: '2026-09-12', reason: 'تست فارسی' };
  let failures = 0;

  // -----------------------------------------------------------------------
  // Scenario 1: Sick → auto-approve end
  // -----------------------------------------------------------------------
  {
    const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
    const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'ثبت درخواست مرخصی');
    await api(john, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Sick' } }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await getInstance(john, inst.id);
    const janeTasks = asList(await api(jane, '/tasks/mine')).filter((t) => t.processInstanceId === inst.id);
    const ok = after.status === 'COMPLETED' && janeTasks.length === 0;
    console.log(`${ok ? '✓ PASS' : '✗ FAIL'} [Sick]    instance status=${after.status}, jane tasks on this instance=${janeTasks.length} (expect COMPLETED / 0 — auto-approve path)`);
    if (!ok) failures++;
  }

  // -----------------------------------------------------------------------
  // Scenario 2: Annual → manager (jane) → notify (john) → completed
  // -----------------------------------------------------------------------
  {
    const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
    const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'ثبت درخواست مرخصی');
    await api(john, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Annual' } }) });
    const approve = await waitForTask(jane, (t) => t.name === 'تایید مدیر مستقیم' && t.processInstanceId === inst.id, 'تایید مدیر مستقیم (jane)');
    console.log(`  ✓ Annual routed to jane → «${approve.name}»`);
    await api(jane, `/tasks/${approve.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { decision: 'تایید', comment: 'موافقم' } }) });
    const notify = await waitForTask(john, (t) => t.name === 'اطلاع‌رسانی نتیجه' && t.processInstanceId === inst.id, 'اطلاع‌رسانی نتیجه (john)');
    console.log(`  ✓ after approval → «${notify.name}» back to john`);
    await api(john, `/tasks/${notify.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { notifyMethod: 'ایمیل' } }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await getInstance(john, inst.id);
    const ok = after.status === 'COMPLETED';
    console.log(`${ok ? '✓ PASS' : '✗ FAIL'} [Annual]  instance status=${after.status} (expect COMPLETED)`);
    if (!ok) failures++;
  }

  // -----------------------------------------------------------------------
  // Scenario 3: Unpaid → HR (bob) → notify (john) → completed
  // -----------------------------------------------------------------------
  {
    const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
    const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'ثبت درخواست مرخصی');
    await api(john, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Unpaid' } }) });
    const approve = await waitForTask(bob, (t) => t.name === 'تایید منابع انسانی' && t.processInstanceId === inst.id, 'تایید منابع انسانی (bob)');
    console.log(`  ✓ Unpaid routed to bob → «${approve.name}»`);
    await api(bob, `/tasks/${approve.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { decision: 'رد', comment: 'ظرفیت نیروی کار کافی نیست' } }) });
    const notify = await waitForTask(john, (t) => t.name === 'اطلاع‌رسانی نتیجه' && t.processInstanceId === inst.id, 'اطلاع‌رسانی نتیجه (john)');
    console.log(`  ✓ after HR decision → «${notify.name}» back to john`);
    await api(john, `/tasks/${notify.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { notifyMethod: 'پیامک' } }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await getInstance(john, inst.id);
    const ok = after.status === 'COMPLETED';
    console.log(`${ok ? '✓ PASS' : '✗ FAIL'} [Unpaid]  instance status=${after.status} (expect COMPLETED)`);
    if (!ok) failures++;
  }

  console.log(failures === 0 ? '\n🎉 ALL PERSIAN PROCESS E2E TESTS PASSED' : `\n💥 ${failures} test(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
