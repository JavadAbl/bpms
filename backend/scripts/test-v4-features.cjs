#!/usr/bin/env node
/**
 * E2E verification for the v4 features (run against a LIVE backend on :3001):
 *
 *  1. Process starters (START event assignment):
 *     - PUT /processes/:id/starters restricts starting to the listed users
 *     - non-starters get 403 (Persian message), starters and admins pass
 *     - an empty starter list lifts the restriction (all users may start)
 *     - guardrails: unknown userId → 400, non-admin PUT → 403
 *  2. کارتابل (task inbox) shows RECEIVED tasks only:
 *     - /tasks/mine returns PENDING tasks exclusively
 *     - after completion the task disappears from the inbox
 *     - admin /tasks lists no completed tasks either
 *     - the passed task shows up in /tasks/participated (سوابق کارتابل);
 *       the two lists stay disjoint and participated is passed-only
 *  3. No-code gateway conditions still satisfy the engine contract:
 *     - the seeded conditions (language="javascript" + next(null, …)) route
 *       instances correctly through the XOR gateway (Annual → manager chain)
 *  4. Process creation carries the starter restriction (create-on-designer-save,
 *     API side): POST /processes {starterIds} creates the ProcessStarter rows.
 *
 * Usage: node scripts/test-v4-features.cjs
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

const MINIMAL_BPMN = (taskName) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DC" id="Defs_v4" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Proc_v4" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="شروع"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="${taskName}"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="End_1" name="پایان"><bpmn:incoming>Flow_2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_v4"><bpmndi:BPMNPlane id="Plane_v4" bpmnElement="Proc_v4">
    <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="150" y="90" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="240" y="70" width="100" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1"><dc:Bounds x="390" y="90" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="186" y="108" /><di:waypoint x="240" y="108" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="340" y="108" /><di:waypoint x="390" y="108" /></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

async function completeTask(token, taskId, data) {
  return api(token, `/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}

async function main() {
  console.log(`🧪 v4 feature E2E — backend at ${BASE}\n`);

  const admin = await login('admin@bpms.local', 'admin123');
  const john = await login('john@bpms.local', 'user123');
  const jane = await login('jane@bpms.local', 'user123');

  // ---------------------------------------------------------------------
  console.log('— Feature 3: no-code gateway conditions (engine contract + routing) —');
  const listRes = await api(admin.accessToken, '/processes');
  const seeded = (listRes.body || []).find((p) => p.name === 'فرآیند درخواست مرخصی');
  ok(!!seeded, 'seeded process «فرآیند درخواست مرخصی» exists');
  ok(
    /language="javascript"/.test(seeded.bpmnXml) && /next\(null,/.test(seeded.bpmnXml),
    'seeded condition XML uses the engine contract (language=javascript + next(null,…))',
  );

  // Annual path: ثبت → تایید مدیر مستقیم (jane) → اطلاع‌رسانی (john) → پایان
  const startAnnual = await api(john.accessToken, '/process-instances', {
    method: 'POST',
    body: JSON.stringify({ processId: seeded.id }),
  });
  ok(startAnnual.status === 200 || startAnnual.status === 201, 'john starts the seeded process (unrestricted)');

  let mine = await api(john.accessToken, '/tasks/mine');
  let submitTask = (mine.body || []).find(
    (tk) => tk.name === 'ثبت درخواست مرخصی' && tk.status === 'PENDING' && tk.processInstance?.id === startAnnual.body?.id,
  );
  ok(!!submitTask, 'john receives the first task in کارتابل');

  // Feature 2 pre-check: inbox contains only PENDING rows
  ok(
    (mine.body || []).every((tk) => tk.status === 'PENDING'),
    'کارتابل (/tasks/mine) lists PENDING tasks only',
  );

  const c1 = await completeTask(john.accessToken, submitTask.id, {
    employeeName: 'جان دو',
    leaveType: 'Annual',
    startDate: '2026-09-10',
    endDate: '2026-09-12',
    reason: 'تست مسیر استحقاقی',
  });
  ok(c1.status === 200 || c1.status === 201, 'john submits the request (leaveType=Annual)');

  // The completed task must be GONE from john's inbox
  mine = await api(john.accessToken, '/tasks/mine');
  ok(
    !(mine.body || []).some((tk) => tk.id === submitTask.id),
    'completed task left john\'s کارتابل immediately',
  );

  const allTasks = await api(admin.accessToken, '/tasks');
  ok(
    (allTasks.body || []).every((tk) => tk.status === 'PENDING'),
    'admin /tasks lists waiting (PENDING) tasks only',
  );

  // Feature 2 follow-up: سوابق کارتابل (participated tasks view)
  let johnPart = await api(john.accessToken, '/tasks/participated');
  const submitInPart = (johnPart.body || []).find((tk) => tk.id === submitTask.id);
  ok(
    !!submitInPart && submitInPart.status === 'COMPLETED' && !!submitInPart.completedAt,
    "the passed task appears in john's سوابق کارتابل (/tasks/participated)",
  );
  ok(
    (johnPart.body || []).every((tk) => tk.status === 'COMPLETED' || tk.status === 'CANCELLED'),
    'participated list contains only passed tasks (COMPLETED/CANCELLED)',
  );

  // Gateway routed Annual → «تایید مدیر مستقیم» (TASK_STARTER_MANAGER → jane)
  const janeMine = await api(jane.accessToken, '/tasks/mine');
  const mgrTask = (janeMine.body || []).find(
    (tk) => tk.name === 'تایید مدیر مستقیم' && tk.status === 'PENDING' && tk.processInstance?.id === startAnnual.body?.id,
  );
  ok(!!mgrTask, 'XOR gateway routed Annual → «تایید مدیر مستقیم» (jane, manager resolution)');

  const c2 = await completeTask(jane.accessToken, mgrTask.id, { decision: 'تایید', comment: 'بازمرد' });
  ok(c2.status === 200 || c2.status === 201, 'jane approves');

  const janePart = await api(jane.accessToken, '/tasks/participated');
  ok(
    (janePart.body || []).some((tk) => tk.id === mgrTask.id),
    "jane's approval task shows in her سوابق کارتابل",
  );

  mine = await api(john.accessToken, '/tasks/mine');
  const notifyTask = (mine.body || []).find(
    (tk) => tk.name === 'اطلاع‌رسانی نتیجه' && tk.processInstance?.id === startAnnual.body?.id,
  );
  ok(!!notifyTask, 'TASK_STARTER routed the notification back to john');

  const c3 = await completeTask(john.accessToken, notifyTask.id, { notifyMethod: 'ایمیل', notifyNote: 'ok' });
  ok(c3.status === 200 || c3.status === 201, 'john completes the notification');

  const instDone = await api(john.accessToken, `/process-instances/${startAnnual.body.id}`);
  ok(instDone.body?.status === 'COMPLETED', 'instance COMPLETED through the full Annual path');

  mine = await api(john.accessToken, '/tasks/mine');
  johnPart = await api(john.accessToken, '/tasks/participated');
  ok(
    (johnPart.body || []).some((tk) => tk.id === notifyTask.id),
    "john's notification task also landed in his سوابق کارتابل",
  );
  const mineIds = new Set((mine.body || []).map((tk) => tk.id));
  ok(
    (johnPart.body || []).every((tk) => !mineIds.has(tk.id)),
    'کارتابل (inbox) and سوابق کارتابل (participated) are disjoint',
  );

  // ---------------------------------------------------------------------
  console.log('\n— Feature 1: process starters (START event assignment) —');

  // non-admin may not change starters
  const johnSet = await api(john.accessToken, `/processes/${seeded.id}/starters`, {
    method: 'PUT',
    body: JSON.stringify({ userIds: [john.userId] }),
  });
  ok(johnSet.status === 403, 'non-admin cannot change starters (403)');

  // restrict to jane
  const setJane = await api(admin.accessToken, `/processes/${seeded.id}/starters`, {
    method: 'PUT',
    body: JSON.stringify({ userIds: [jane.userId] }),
  });
  ok(setJane.status === 200 || setJane.status === 201, 'admin sets starters = [jane]');
  ok(
    Array.isArray(setJane.body) && setJane.body.length === 1 && setJane.body[0].userId === jane.userId,
    'starters endpoint returns the jane row',
  );

  const detail = await api(admin.accessToken, `/processes/${seeded.id}`);
  ok(
    Array.isArray(detail.body?.starters) && detail.body.starters.length === 1 &&
      detail.body.starters[0].userId === jane.userId,
    'process detail serializes starters',
  );

  // john (non-starter) → 403 with the Persian message
  const johnStart = await api(john.accessToken, '/process-instances', {
    method: 'POST',
    body: JSON.stringify({ processId: seeded.id }),
  });
  ok(johnStart.status === 403, 'non-starter john gets 403 on start');
  ok(
    typeof johnStart.body?.message === 'string' && johnStart.body.message.includes('مجاز'),
    '403 message is the Persian «شما مجاز به شروع این فرآیند نیستید…»',
  );

  // jane (starter) → 200
  const janeStart = await api(jane.accessToken, '/process-instances', {
    method: 'POST',
    body: JSON.stringify({ processId: seeded.id }),
  });
  ok(janeStart.status === 200 || janeStart.status === 201, 'starter jane may start');

  // admin bypass → 200
  const adminStart = await api(admin.accessToken, '/process-instances', {
    method: 'POST',
    body: JSON.stringify({ processId: seeded.id }),
  });
  ok(adminStart.status === 200 || adminStart.status === 201, 'admin bypasses the starter restriction');

  // terminate the two running instances (starter/admin may)
  for (const inst of [janeStart.body, adminStart.body]) {
    if (inst?.id) {
      await api(admin.accessToken, `/process-instances/${inst.id}/terminate`, { method: 'POST' });
    }
  }

  // empty list lifts the restriction
  const clearRes = await api(admin.accessToken, `/processes/${seeded.id}/starters`, {
    method: 'PUT',
    body: JSON.stringify({ userIds: [] }),
  });
  ok(clearRes.status === 200 || clearRes.status === 201, 'admin clears starters (empty = all users)');
  const johnStart2 = await api(john.accessToken, '/process-instances', {
    method: 'POST',
    body: JSON.stringify({ processId: seeded.id }),
  });
  ok(johnStart2.status === 200 || johnStart2.status === 201, 'john may start again after the restriction is lifted');
  if (johnStart2.body?.id) {
    await api(john.accessToken, `/process-instances/${johnStart2.body.id}/terminate`, { method: 'POST' });
  }

  // guardrail: unknown user id → 400
  const badSet = await api(admin.accessToken, `/processes/${seeded.id}/starters`, {
    method: 'PUT',
    body: JSON.stringify({ userIds: ['00000000-0000-4000-8000-000000000000'] }),
  });
  ok(badSet.status === 400, 'unknown starter userId → 400');
  // restore unrestricted state for the seeded demo
  await api(admin.accessToken, `/processes/${seeded.id}/starters`, {
    method: 'PUT',
    body: JSON.stringify({ userIds: [] }),
  });

  // ---------------------------------------------------------------------
  console.log('\n— Feature 4: create-with-starters (API side of create-on-save) —');

  // idempotent: previous runs may leave the process behind (terminated
  // instances block deletion via FK restrict — no instance-delete endpoint),
  // so delete what we can and REUSE whatever remains.
  const v4Name = 'فرآیند تست v4 شروع محدود';
  const leftovers = (listRes.body || []).filter((p) => p.name === v4Name);
  let v4proc = null;
  for (const p of leftovers.slice(1)) {
    await api(admin.accessToken, `/processes/${p.id}`, { method: 'DELETE' });
  }
  if (leftovers.length > 0) {
    // reuse the first leftover: fresh XML + starter set + ACTIVE
    v4proc = leftovers[0];
    await api(admin.accessToken, `/processes/${v4proc.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ bpmnXml: MINIMAL_BPMN('وظیفه تست'), status: 'ACTIVE' }),
    });
    await api(admin.accessToken, `/processes/${v4proc.id}/starters`, {
      method: 'PUT',
      body: JSON.stringify({ userIds: [john.userId] }),
    });
    const refreshed = await api(admin.accessToken, `/processes/${v4proc.id}`);
    v4proc = refreshed.body;
    ok(true, 'reused the leftover v4 test process (idempotent rerun)');
  }
  if (!v4proc) {
    const createRes = await api(admin.accessToken, '/processes', {
      method: 'POST',
      body: JSON.stringify({
        name: v4Name,
        description: 'تست محدودیت شروع‌کنندگان',
        bpmnXml: MINIMAL_BPMN('وظیفه تست'),
        starterIds: [john.userId],
      }),
    });
    ok(createRes.status === 201 || createRes.status === 200, 'process created with starterIds=[john]');
    v4proc = createRes.body;
    await api(admin.accessToken, `/processes/${v4proc.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
  }
  ok(
    Array.isArray(v4proc?.starters) && v4proc.starters.length === 1 &&
      v4proc.starters[0].userId === john.userId,
    'v4 test process carries the starter restriction [john]',
  );

  await api(admin.accessToken, `/processes/${v4proc.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
  const janeBlocked = await api(jane.accessToken, '/process-instances', {
    method: 'POST',
    body: JSON.stringify({ processId: v4proc.id }),
  });
  ok(janeBlocked.status === 403, 'jane (not a starter) blocked from the new process');
  const johnAllowed = await api(john.accessToken, '/process-instances', {
    method: 'POST',
    body: JSON.stringify({ processId: v4proc.id }),
  });
  ok(johnAllowed.status === 200 || johnAllowed.status === 201, 'john (starter) may start the new process');
  if (johnAllowed.body?.id) {
    await api(john.accessToken, `/process-instances/${johnAllowed.body.id}/terminate`, { method: 'POST' });
  }

  console.log(`\n— Result: ${pass} passed, ${fail} failed —`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('SUITE ERROR:', e.message);
  process.exit(1);
});
