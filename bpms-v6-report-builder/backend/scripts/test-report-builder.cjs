#!/usr/bin/env node
/**
 * E2E verification for the v6 REPORT BUILDER (run against LIVE backend :3001):
 *
 *  "Admin can create reports for each process by selecting among processes
 *   data and vars."
 *
 *  1. Seeded regression: the 2 seeded reports list + execute; field-catalog
 *     merges instance fields, declared variables AND form-derived variables,
 *     with Persian select labels resolved from categories.
 *  2. Permissions: USER may read/execute reports; writes (create/update/
 *     delete) and preview are ADMIN-only → 403.
 *  3. Validation: empty columns / unknown INSTANCE fieldKey / duplicate
 *     column keys / bad STATUS filter / inverted DATE_RANGE → 400.
 *  4. Full data flow: create a report with a unique per-run VARIABLE filter
 *     → start the seeded leave instance → john submits (Annual) → jane
 *     approves → john notifies → instance COMPLETED. Each execute reflects
 *     the live state (row count, status, variable values).
 *  5. Filters: STATUS / VARIABLE eq-neq / DATE_RANGE bounds.
 *  6. Preview equals execute for the same config; PATCH updates columns.
 *  7. Cleanup: delete the test report (instance history stays, like other suites).
 */
const BASE = process.env.BPMS_BASE || 'http://localhost:3001/api';

let pass = 0;
let fail = 0;

function ok(cond, label, extra) {
  if (cond) {
    pass++;
    console.log(`  ✓ PASS ${label}`);
  } else {
    fail++;
    console.log(`  ✗ FAIL ${label}${extra ? ` — ${extra}` : ''}`);
  }
}

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`);
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
  try {
    body = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, body };
}

async function findPendingTask(token, processId, taskName) {
  const { body } = await api(token, '/tasks/mine');
  return (body || []).find(
    (t) => t.name === taskName && t.processInstance?.process?.id === processId,
  );
}

async function main() {
  const admin = await login('admin@bpms.local', 'admin123');
  const john = await login('john@bpms.local', 'user123');
  const jane = await login('jane@bpms.local', 'user123');
  const adminTok = admin.accessToken;
  const johnTok = john.accessToken;

  const processes = (await api(adminTok, '/processes')).body;
  const proc = processes.find((p) => p.name === 'فرآیند درخواست مرخصی');
  ok(!!proc, 'seeded leave process found');
  if (!proc) process.exit(1);

  console.log('\n— 1) seeded reports + field catalog —');
  const reports = (await api(adminTok, '/reports')).body;
  ok(Array.isArray(reports) && reports.length >= 2, `reports list has ≥2 seeded rows (${reports.length})`);
  const seedReport = reports.find((r) => r.name === 'گزارش مرخصی‌ها');
  ok(!!seedReport, 'seeded «گزارش مرخصی‌ها» present');
  ok(seedReport.columnCount === 9, `seeded report columnCount = 9 (${seedReport.columnCount})`);
  const seedExec = await api(adminTok, `/reports/${seedReport.id}/execute`, { method: 'POST' });
  ok(
    (seedExec.status === 200 || seedExec.status === 201) && Array.isArray(seedExec.body.columns),
    `seeded report executes (${seedExec.status})`,
  );
  ok(
    seedExec.body.columns.every((c) => c.label && c.type),
    'every executed column is resolved with label+type',
  );

  const catalog = (await api(adminTok, `/reports/field-catalog/${proc.id}`)).body;
  ok(catalog.instanceFields.length === 8, `catalog instanceFields = 8 (${catalog.instanceFields.length})`);
  const varNames = catalog.variables.map((v) => v.name);
  ok(
    varNames.includes('leaveType') && varNames.includes('employeeName'),
    'declared process variables present',
  );
  ok(
    varNames.includes('attachments') && varNames.includes('notifyMethod'),
    'form-derived variables present (attachments, notifyMethod)',
  );
  const leaveTypeVar = catalog.variables.find((v) => v.name === 'leaveType');
  ok(!!leaveTypeVar?.options, 'leaveType has resolved options');
  const annual = (leaveTypeVar?.options || []).find((o) => o.value === 'Annual');
  ok(annual?.label === 'مرخصی استحقاقی', `Persian label for Annual (${annual?.label})`);

  console.log('\n— 2) permissions —');
  const johnList = await api(johnTok, '/reports');
  ok(johnList.status === 200, 'USER can list reports (200)');
  const johnExec = await api(johnTok, `/reports/${seedReport.id}/execute`, { method: 'POST' });
  ok(johnExec.status === 200 || johnExec.status === 201, `USER can execute a report (${johnExec.status})`);
  const johnCreate = await api(johnTok, '/reports', {
    method: 'POST',
    body: JSON.stringify({
      name: 'x',
      processId: proc.id,
      columns: [{ key: 'field:status', source: 'INSTANCE', fieldKey: 'status' }],
    }),
  });
  ok(johnCreate.status === 403, `USER create report → 403 (${johnCreate.status})`);
  const johnPreview = await api(johnTok, '/reports/preview', {
    method: 'POST',
    body: JSON.stringify({
      processId: proc.id,
      columns: [{ key: 'field:status', source: 'INSTANCE', fieldKey: 'status' }],
    }),
  });
  ok(johnPreview.status === 403, `USER preview → 403 (${johnPreview.status})`);
  const johnPatch = await api(johnTok, `/reports/${seedReport.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'x' }),
  });
  ok(johnPatch.status === 403, `USER update report → 403 (${johnPatch.status})`);

  console.log('\n— 3) validation —');
  const v1 = await api(adminTok, '/reports', {
    method: 'POST',
    body: JSON.stringify({
      name: 'خالی',
      processId: proc.id,
      columns: [],
    }),
  });
  ok(v1.status === 400, `empty columns → 400 (${v1.status})`);
  const v2 = await api(adminTok, '/reports', {
    method: 'POST',
    body: JSON.stringify({
      name: 'بد',
      processId: proc.id,
      columns: [{ key: 'field:nope', source: 'INSTANCE', fieldKey: 'nope' }],
    }),
  });
  ok(v2.status === 400, `unknown INSTANCE fieldKey → 400 (${v2.status})`);
  const v3 = await api(adminTok, '/reports', {
    method: 'POST',
    body: JSON.stringify({
      name: 'تکراری',
      processId: proc.id,
      columns: [
        { key: 'field:status', source: 'INSTANCE', fieldKey: 'status' },
        { key: 'field:status', source: 'INSTANCE', fieldKey: 'status' },
      ],
    }),
  });
  ok(v3.status === 400, `duplicate column keys → 400 (${v3.status})`);
  const v4 = await api(adminTok, '/reports', {
    method: 'POST',
    body: JSON.stringify({
      name: 'فیلتر بد',
      processId: proc.id,
      columns: [{ key: 'field:status', source: 'INSTANCE', fieldKey: 'status' }],
      filters: [{ type: 'STATUS', statuses: ['NOT_A_STATUS'] }],
    }),
  });
  ok(v4.status === 400, `invalid status filter → 400 (${v4.status})`);
  const v5 = await api(adminTok, '/reports', {
    method: 'POST',
    body: JSON.stringify({
      name: 'تاریخ بد',
      processId: proc.id,
      columns: [{ key: 'field:status', source: 'INSTANCE', fieldKey: 'status' }],
      filters: [{ type: 'DATE_RANGE', from: '2030-01-01', to: '2020-01-01' }],
    }),
  });
  ok(v5.status === 400, `inverted date range → 400 (${v5.status})`);

  console.log('\n— 4) create report + full instance data flow —');
  const E2E_NAME = `تست گزارش‌ساز ${Date.now()}`;
  const columns = [
    { key: 'field:status', source: 'INSTANCE', fieldKey: 'status' },
    { key: 'field:startedBy', source: 'INSTANCE', fieldKey: 'startedBy' },
    { key: 'field:durationDays', source: 'INSTANCE', fieldKey: 'durationDays' },
    { key: 'field:taskCount', source: 'INSTANCE', fieldKey: 'taskCount' },
    { key: 'field:completedTaskCount', source: 'INSTANCE', fieldKey: 'completedTaskCount' },
    { key: 'var:employeeName', source: 'VARIABLE', fieldKey: 'employeeName' },
    { key: 'var:leaveType', source: 'VARIABLE', fieldKey: 'leaveType' },
    { key: 'var:decision', source: 'VARIABLE', fieldKey: 'decision' },
  ];
  // Unique per-run variable filter → the report only sees THIS run's instance
  const createFilters = [{ type: 'VARIABLE', name: 'employeeName', op: 'eq', value: E2E_NAME }];
  const created = await api(adminTok, '/reports', {
    method: 'POST',
    body: JSON.stringify({
      name: 'E2E گزارش تست',
      description: 'ساخت خودکار توسط تست',
      processId: proc.id,
      columns,
      filters: createFilters,
    }),
  });
  ok(created.status === 201 || created.status === 200, `report created (${created.status})`);
  const reportId = created.body.id;

  const exec0 = await api(adminTok, `/reports/${reportId}/execute`, { method: 'POST' });
  ok(exec0.body.total === 0, `empty state before any instance (${exec0.body.total})`);

  // Start the instance (admin may always start)
  const startRes = await api(adminTok, '/process-instances', {
    method: 'POST',
    body: JSON.stringify({ processId: proc.id }),
  });
  ok(startRes.status === 201 || startRes.status === 200, `instance started (${startRes.status})`);

  // john completes the request form (Annual path → manager approval)
  let task = null;
  for (let i = 0; i < 10 && !task; i++) {
    task = await findPendingTask(johnTok, proc.id, 'ثبت درخواست مرخصی');
    if (!task) await new Promise((r) => setTimeout(r, 300));
  }
  ok(!!task, 'john sees the registration task');
  const submit = await api(johnTok, `/tasks/${task.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        employeeName: E2E_NAME,
        leaveType: 'Annual',
        startDate: '2026-09-10',
        endDate: '2026-09-15',
        reason: 'e2e',
      },
    }),
  });
  ok(submit.status === 201 || submit.status === 200, `john submitted Annual request (${submit.status})`);

  const exec1 = await api(adminTok, `/reports/${reportId}/execute`, { method: 'POST' });
  ok(exec1.body.total === 1, `report sees the RUNNING instance (${exec1.body.total})`);
  const row1 = exec1.body.rows[0];
  ok(row1?.status === 'RUNNING', `row status RUNNING (${row1?.status})`);
  ok(row1?.values['var:employeeName'] === E2E_NAME, 'employeeName variable resolved from submission');
  ok(row1?.values['var:leaveType'] === 'Annual', 'leaveType variable resolved (Annual)');
  ok(row1?.values['field:taskCount'] >= 1, `taskCount computed (${row1?.values['field:taskCount']})`);

  // jane (manager of the performer) approves
  let approval = null;
  for (let i = 0; i < 10 && !approval; i++) {
    approval = await findPendingTask(jane.accessToken, proc.id, 'تایید مدیر مستقیم');
    if (!approval) await new Promise((r) => setTimeout(r, 300));
  }
  ok(!!approval, 'jane sees the manager approval task');
  const approve = await api(jane.accessToken, `/tasks/${approval.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ data: { decision: 'تایید', comment: 'e2e ok' } }),
  });
  ok(approve.status === 201 || approve.status === 200, `jane approved (${approve.status})`);

  // john completes the notification step → instance COMPLETED
  let notify = null;
  for (let i = 0; i < 10 && !notify; i++) {
    notify = await findPendingTask(johnTok, proc.id, 'اطلاع‌رسانی نتیجه');
    if (!notify) await new Promise((r) => setTimeout(r, 300));
  }
  ok(!!notify, 'john sees the notification task');
  const notif = await api(johnTok, `/tasks/${notify.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ data: { notifyMethod: 'ایمیل', notifyNote: 'e2e' } }),
  });
  ok(notif.status === 201 || notif.status === 200, `john notified (${notif.status})`);

  const exec2 = await api(adminTok, `/reports/${reportId}/execute`, { method: 'POST' });
  ok(exec2.body.total === 1, `still exactly this run's instance (${exec2.body.total})`);
  const row2 = exec2.body.rows[0];
  ok(row2?.status === 'COMPLETED', `row status COMPLETED (${row2?.status})`);
  ok(row2?.values['var:decision'] === 'تایید', 'decision variable resolved (تایید)');
  ok(
    row2?.values['field:completedTaskCount'] === row2?.values['field:taskCount'],
    `all tasks completed (${row2?.values['field:completedTaskCount']}/${row2?.values['field:taskCount']})`,
  );
  const leaveCol = exec2.body.columns.find((c) => c.key === 'var:leaveType');
  ok(leaveCol?.options?.some((o) => o.value === 'Annual' && o.label === 'مرخصی استحقاقی'),
    'executed leaveType column carries Persian options');

  console.log('\n— 5) filters —');
  // STATUS filter excludes the completed instance
  const statusRep = await api(adminTok, '/reports/preview', {
    method: 'POST',
    body: JSON.stringify({
      processId: proc.id,
      columns,
      filters: [
        ...createFilters,
        { type: 'STATUS', statuses: ['RUNNING'] },
      ],
    }),
  });
  ok(statusRep.body.total === 0, `STATUS [RUNNING] filter drops the completed row (${statusRep.body.total})`);

  // VARIABLE eq / neq
  const eqSick = await api(adminTok, '/reports/preview', {
    method: 'POST',
    body: JSON.stringify({
      processId: proc.id,
      columns,
      filters: [{ type: 'VARIABLE', name: 'leaveType', op: 'eq', value: 'Sick' }],
    }),
  });
  ok(eqSick.body.total === 0, `leaveType eq Sick → 0 rows (${eqSick.body.total})`);
  const neqSick = await api(adminTok, '/reports/preview', {
    method: 'POST',
    body: JSON.stringify({
      processId: proc.id,
      columns,
      filters: [{ type: 'VARIABLE', name: 'leaveType', op: 'neq', value: 'Sick' }],
    }),
  });
  ok(neqSick.body.total >= 1, `leaveType neq Sick → ≥1 rows (${neqSick.body.total})`);
  const contains = await api(adminTok, '/reports/preview', {
    method: 'POST',
    body: JSON.stringify({
      processId: proc.id,
      columns,
      filters: [{ type: 'VARIABLE', name: 'employeeName', op: 'contains', value: 'گزارش‌ساز' }],
    }),
  });
  ok(contains.body.total >= 1, `employeeName contains → ≥1 rows (${contains.body.total})`);

  // DATE_RANGE: today includes, yesterday excludes
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dateIn = await api(adminTok, '/reports/preview', {
    method: 'POST',
    body: JSON.stringify({
      processId: proc.id,
      columns,
      filters: [...createFilters, { type: 'DATE_RANGE', from: today }],
    }),
  });
  ok(dateIn.body.total === 1, `from=today keeps the row (${dateIn.body.total})`);
  const dateOut = await api(adminTok, '/reports/preview', {
    method: 'POST',
    body: JSON.stringify({
      processId: proc.id,
      columns,
      filters: [...createFilters, { type: 'DATE_RANGE', to: yesterday }],
    }),
  });
  ok(dateOut.body.total === 0, `to=yesterday drops the row (${dateOut.body.total})`);

  console.log('\n— 6) preview ≡ execute + PATCH —');
  const sameConfig = await api(adminTok, '/reports/preview', {
    method: 'POST',
    body: JSON.stringify({ processId: proc.id, columns, filters: createFilters }),
  });
  ok(
    sameConfig.body.total === exec2.body.total &&
      JSON.stringify(sameConfig.body.columns) === JSON.stringify(exec2.body.columns),
    'preview (unsaved) equals execute (saved) for the same config',
  );

  const patched = await api(adminTok, `/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: 'E2E گزارش تست (ویرایش)',
      columns: [
        ...columns.slice(0, 3),
        { key: 'var:leaveType', source: 'VARIABLE', fieldKey: 'leaveType', label: 'نوع مرخصی (سفارشی)' },
      ],
    }),
  });
  ok(patched.status === 200 && patched.body.name === 'E2E گزارش تست (ویرایش)', 'PATCH renames the report');
  const exec3 = await api(adminTok, `/reports/${reportId}/execute`, { method: 'POST' });
  const customCol = exec3.body.columns.find((c) => c.key === 'var:leaveType');
  ok(customCol?.label === 'نوع مرخصی (سفارشی)', `custom column label honored (${customCol?.label})`);
  ok(exec3.body.columns.length === 4, `updated column count (${exec3.body.columns.length})`);

  console.log('\n— 7) cleanup —');
  const del = await api(adminTok, `/reports/${reportId}`, { method: 'DELETE' });
  ok(del.status === 200, `test report deleted (${del.status})`);
  const after = (await api(adminTok, '/reports')).body;
  ok(!after.some((r) => r.id === reportId), 'deleted report gone from list');
  ok(after.some((r) => r.name === 'گزارش مرخصی‌ها'), 'seeded reports untouched');

  console.log(`\n=========================================`);
  console.log(`RESULT: ${pass} passed, ${fail} failed`);
  console.log(`=========================================`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E suite crashed:', e);
  process.exit(1);
});
