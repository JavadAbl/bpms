/**
 * E2E test — GET /api/dashboard aggregates (UI redesign Phase 3):
 *   - 401 without token
 *   - response shape (7 fields, 7-day series, all 4 statuses)
 *   - live flow: john starts Annual leave → RUNNING/PENDING KPIs increment
 *     → flow completes → COMPLETED KPIs increment, RUNNING decrements
 *   - cross-checks against list endpoints (/tasks, /tasks/mine,
 *     /process-instances, /process-instances/mine, /processes)
 *   - scope isolation: USER numbers ≤ ADMIN numbers; recent* ⊆ own lists
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
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const err = new Error(`${options.method || 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
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
  // --- guardrail: 401 without token --------------------------------------
  const noAuth = await fetch(`${API}/dashboard`);
  check(noAuth.status === 401, '401 without token', `status=${noAuth.status}`);

  const [admin, john, jane] = await Promise.all([
    login('admin@bpms.local', 'admin123'),
    login('john@bpms.local', 'user123'),
    login('jane@bpms.local', 'user123'),
  ]);

  // --- shape --------------------------------------------------------------
  const d0 = await api(admin, '/dashboard');
  const shapeOk =
    typeof d0.myPendingTasks === 'number' &&
    typeof d0.runningInstances === 'number' &&
    typeof d0.activeProcesses === 'number' &&
    Array.isArray(d0.completedLast7Days) && d0.completedLast7Days.length === 7 &&
    typeof d0.instancesByStatus === 'object' &&
    Array.isArray(d0.recentTasks) && Array.isArray(d0.recentInstances);
  check(shapeOk, 'response shape', `keys=${Object.keys(d0).join(',')}`);
  const allStatuses = ['RUNNING', 'COMPLETED', 'FAILED', 'TERMINATED'].every((s) => s in d0.instancesByStatus);
  check(allStatuses, 'instancesByStatus covers all 4 statuses', JSON.stringify(d0.instancesByStatus));
  const datesOk = d0.completedLast7Days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));
  check(datesOk, '7-day series has ISO dates', d0.completedLast7Days.map((d) => d.date).join('..'));

  // --- baselines before the live flow -------------------------------------
  const j0 = await api(john, '/dashboard');
  const adminTasks = asList(await api(admin, '/tasks'));
  const adminInstances = asList(await api(admin, '/process-instances'));
  const adminProcesses = asList(await api(admin, '/processes'));
  const johnTasks = asList(await api(john, '/tasks/mine'));
  const johnInstances = asList(await api(john, '/process-instances/mine'));

  check(d0.myPendingTasks === adminTasks.filter((t) => t.status === 'PENDING').length,
    'admin myPendingTasks == /tasks PENDING count', `dash=${d0.myPendingTasks}`);
  check(d0.runningInstances === adminInstances.filter((i) => i.status === 'RUNNING').length,
    'admin runningInstances == /process-instances RUNNING count', `dash=${d0.runningInstances}`);
  check(d0.activeProcesses === adminProcesses.filter((p) => p.status === 'ACTIVE').length,
    'admin activeProcesses == /processes ACTIVE count', `dash=${d0.activeProcesses}`);
  const statusSum = Object.values(d0.instancesByStatus).reduce((a, b) => a + b, 0);
  check(statusSum === adminInstances.length, 'instancesByStatus sums to total instances', `sum=${statusSum}, total=${adminInstances.length}`);
  check(d0.recentTasks.length <= 5 && d0.recentInstances.length <= 5, 'recent* capped at 5', `tasks=${d0.recentTasks.length}, instances=${d0.recentInstances.length}`);

  // USER scope cross-checks
  check(j0.myPendingTasks === johnTasks.filter((t) => t.status === 'PENDING').length,
    'john myPendingTasks == /tasks/mine PENDING count', `dash=${j0.myPendingTasks}`);
  check(j0.runningInstances === johnInstances.filter((i) => i.status === 'RUNNING').length,
    'john runningInstances == /process-instances/mine RUNNING count', `dash=${j0.runningInstances}`);
  check(j0.recentTasks.every((rt) => johnTasks.some((mt) => mt.id === rt.id)),
    'john recentTasks ⊆ /tasks/mine', `${j0.recentTasks.length} recent`);
  check(j0.recentInstances.every((ri) => johnInstances.some((mi) => mi.id === ri.id)),
    'john recentInstances ⊆ /process-instances/mine', `${j0.recentInstances.length} recent`);

  // --- live flow: john starts Annual leave ---------------------------------
  const proc = asList(await api(john, '/processes')).find((p) => p.name === 'فرآیند درخواست مرخصی');
  if (!proc) throw new Error('Persian process not found');
  const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });

  const d1 = await api(admin, '/dashboard');
  const j1 = await api(john, '/dashboard');
  check(d1.runningInstances === d0.runningInstances + 1, 'ADMIN runningInstances +1 after start', `${d0.runningInstances}→${d1.runningInstances}`);
  check(d1.instancesByStatus.RUNNING === d0.instancesByStatus.RUNNING + 1, 'ADMIN instancesByStatus.RUNNING +1', `${d0.instancesByStatus.RUNNING}→${d1.instancesByStatus.RUNNING}`);
  check(j1.runningInstances === j0.runningInstances + 1, 'john runningInstances +1', `${j0.runningInstances}→${j1.runningInstances}`);
  check(j1.myPendingTasks === j0.myPendingTasks + 1, 'john myPendingTasks +1 (submit task)', `${j0.myPendingTasks}→${j1.myPendingTasks}`);
  check(j1.recentInstances[0] && j1.recentInstances[0].id === inst.id, 'john recentInstances[0] == new instance', `id=${(j1.recentInstances[0] || {}).id}`);
  check(j1.recentTasks[0] && j1.recentTasks[0].processInstanceId === inst.id, 'john recentTasks[0] belongs to new instance', `task="${(j1.recentTasks[0] || {}).name}"`);

  // --- complete the Annual flow: john → jane → john -------------------------
  const submitForm = { employeeName: 'داشبورد تست', startDate: '2026-09-20', endDate: '2026-09-21', reason: 'تست KPI' };
  const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'ثبت درخواست مرخصی');
  await api(john, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Annual' } }) });
  const approve = await waitForTask(jane, (t) => t.name === 'تایید مدیر مستقیم' && t.processInstanceId === inst.id, 'تایید مدیر مستقیم (jane)');
  await api(jane, `/tasks/${approve.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { decision: 'تایید', comment: 'موافقم' } }) });
  const notify = await waitForTask(john, (t) => t.name === 'اطلاع‌رسانی نتیجه' && t.processInstanceId === inst.id, 'اطلاع‌رسانی نتیجه (john)');
  await api(john, `/tasks/${notify.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { notifyMethod: 'ایمیل' } }) });
  await new Promise((r) => setTimeout(r, 1500));

  const after = await api(john, `/process-instances/${inst.id}`);
  check(after.status === 'COMPLETED', 'flow completed', `status=${after.status}`);

  const d2 = await api(admin, '/dashboard');
  const j2 = await api(john, '/dashboard');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const todayCountAdmin = d2.completedLast7Days.find((d) => d.date === todayIso)?.count ?? -1;
  const todayCountJohn = j2.completedLast7Days.find((d) => d.date === todayIso)?.count ?? -1;
  const beforeAdmin = d0.completedLast7Days.find((d) => d.date === todayIso)?.count ?? 0;
  const beforeJohn = j0.completedLast7Days.find((d) => d.date === todayIso)?.count ?? 0;
  check(todayCountAdmin === beforeAdmin + 1, 'ADMIN completedLast7Days[today] +1', `${beforeAdmin}→${todayCountAdmin} (${todayIso})`);
  check(todayCountJohn === beforeJohn + 1, 'john completedLast7Days[today] +1', `${beforeJohn}→${todayCountJohn}`);
  check(d2.runningInstances === d1.runningInstances - 1, 'ADMIN runningInstances -1 after completion', `${d1.runningInstances}→${d2.runningInstances}`);
  check(d2.instancesByStatus.COMPLETED === d0.instancesByStatus.COMPLETED + 1, 'ADMIN instancesByStatus.COMPLETED +1', `${d0.instancesByStatus.COMPLETED}→${d2.instancesByStatus.COMPLETED}`);
  check(j2.recentTasks[0] && j2.recentTasks[0].id === notify.id, 'john recentTasks[0] == notify task', `task="${(j2.recentTasks[0] || {}).name}"`);

  // --- scope isolation: USER numbers never exceed ADMIN numbers -------------
  check(j2.runningInstances <= d2.runningInstances && j2.myPendingTasks <= d2.myPendingTasks,
    'USER KPIs ≤ ADMIN KPIs', `tasks ${j2.myPendingTasks}≤${d2.myPendingTasks}, running ${j2.runningInstances}≤${d2.runningInstances}`);

  console.log(failures === 0 ? '\n🎉 ALL DASHBOARD E2E TESTS PASSED' : `\n💥 ${failures} test(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
