/**
 * E2E test — TASK-SCOPED starter assignment (replaces the process-level INITIATOR*):
 *   TASK_STARTER         → the user who completed sourceTaskName in this instance
 *   TASK_STARTER_MANAGER → the manager (isManager position) of that performer's
 *                          department(s), resolved at task-creation time
 * The designer picks WHICH earlier task the routing follows, so ONE instance can
 * pass work to MANY different managers based on the starters of DIFFERENT tasks.
 *
 * Scenarios:
 *   1. Seeded Persian leave process:
 *        Annual  → تایید مدیر مستقیم resolved from «ثبت درخواست مرخصی» performer
 *                  (john) → jane (مدیر مهندسی); notify-back → performer (john)
 *        Sick    → auto-approve, notify-back still lands on john
 *        Unpaid  → POSITION pool (bob) regression
 *   2. Server-side guardrails: starter strategies require a DIFFERENT existing
 *      sourceTaskName; removed INITIATOR strategy is rejected.
 *   3. Synthetic multi-starter process (parallel 3-way):
 *        ثبت مهندسی (john) / ثبت مالی (bob) / ثبت اداری (admin)
 *        → تایید مهندسی = manager of john's task performer  → jane
 *        → تایید اداری = manager of admin (no dept)         → admin fallback
 *        → ارجاع مالی  = performer of bob's task themself   → bob
 *
 * Org structure (Persian seed):
 *   john (کارشناس فنی، مهندسی)      → manager = jane (مدیر مهندسی، isManager)
 *   jane (مدیر مهندسی، isManager)   — also کارشناس مالی
 *   bob  (مدیر منابع انسانی، isManager)
 *   admin — holds NO position (tests the fallback path)
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
  if (!res.ok) {
    const err = new Error(`${options.method || 'GET'} ${path} → ${res.status}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

const asList = (d) => (Array.isArray(d) ? d : d.items || d.data || []);

async function waitForTask(token, predicate, label, attempts = 24) {
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

const MULTI_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="defs-multistarter" targetNamespace="http://bpms.local/bpms">
  <bpmn:process id="multi-starter-proc" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="شروع"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:parallelGateway id="Split_1" name="تفکیک"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing><bpmn:outgoing>F3</bpmn:outgoing><bpmn:outgoing>F9</bpmn:outgoing></bpmn:parallelGateway>
    <bpmn:userTask id="Task_Eng" name="ثبت درخواست مهندسی"><bpmn:incoming>F2</bpmn:incoming><bpmn:outgoing>F4</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_Fin" name="ثبت درخواست مالی"><bpmn:incoming>F3</bpmn:incoming><bpmn:outgoing>F5</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_Adm" name="ثبت درخواست اداری"><bpmn:incoming>F9</bpmn:incoming><bpmn:outgoing>F10</bpmn:outgoing></bpmn:userTask>
    <bpmn:parallelGateway id="Join_1"><bpmn:incoming>F4</bpmn:incoming><bpmn:incoming>F5</bpmn:incoming><bpmn:incoming>F10</bpmn:incoming><bpmn:outgoing>F6</bpmn:outgoing></bpmn:parallelGateway>
    <bpmn:userTask id="Task_EngAp" name="تایید مهندسی"><bpmn:incoming>F6</bpmn:incoming><bpmn:outgoing>F7</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_AdmAp" name="تایید اداری"><bpmn:incoming>F7</bpmn:incoming><bpmn:outgoing>F11</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_FinRef" name="ارجاع مالی"><bpmn:incoming>F11</bpmn:incoming><bpmn:outgoing>F8</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="End_1" name="پایان"><bpmn:incoming>F8</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="Start_1" targetRef="Split_1"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Split_1" targetRef="Task_Eng"/>
    <bpmn:sequenceFlow id="F3" sourceRef="Split_1" targetRef="Task_Fin"/>
    <bpmn:sequenceFlow id="F4" sourceRef="Task_Eng" targetRef="Join_1"/>
    <bpmn:sequenceFlow id="F5" sourceRef="Task_Fin" targetRef="Join_1"/>
    <bpmn:sequenceFlow id="F6" sourceRef="Join_1" targetRef="Task_EngAp"/>
    <bpmn:sequenceFlow id="F7" sourceRef="Task_EngAp" targetRef="Task_AdmAp"/>
    <bpmn:sequenceFlow id="F8" sourceRef="Task_FinRef" targetRef="End_1"/>
    <bpmn:sequenceFlow id="F9" sourceRef="Split_1" targetRef="Task_Adm"/>
    <bpmn:sequenceFlow id="F10" sourceRef="Task_Adm" targetRef="Join_1"/>
    <bpmn:sequenceFlow id="F11" sourceRef="Task_AdmAp" targetRef="Task_FinRef"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="DI_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="multi-starter-proc">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="160" y="178" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Split_1_di" bpmnElement="Split_1"><dc:Bounds x="240" y="171" width="50" height="50"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Eng_di" bpmnElement="Task_Eng"><dc:Bounds x="350" y="60" width="150" height="70"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Fin_di" bpmnElement="Task_Fin"><dc:Bounds x="350" y="165" width="150" height="70"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Adm_di" bpmnElement="Task_Adm"><dc:Bounds x="350" y="270" width="150" height="70"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Join_1_di" bpmnElement="Join_1"><dc:Bounds x="550" y="171" width="50" height="50"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_EngAp_di" bpmnElement="Task_EngAp"><dc:Bounds x="650" y="60" width="140" height="70"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_AdmAp_di" bpmnElement="Task_AdmAp"><dc:Bounds x="650" y="165" width="140" height="70"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_FinRef_di" bpmnElement="Task_FinRef"><dc:Bounds x="650" y="270" width="140" height="70"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1"><dc:Bounds x="840" y="178" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint x="196" y="196"/><di:waypoint x="240" y="196"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F2_di" bpmnElement="F2"><di:waypoint x="265" y="171"/><di:waypoint x="265" y="95"/><di:waypoint x="350" y="95"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F3_di" bpmnElement="F3"><di:waypoint x="290" y="196"/><di:waypoint x="290" y="200"/><di:waypoint x="350" y="200"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F4_di" bpmnElement="F4"><di:waypoint x="500" y="95"/><di:waypoint x="575" y="95"/><di:waypoint x="575" y="171"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F5_di" bpmnElement="F5"><di:waypoint x="500" y="200"/><di:waypoint x="550" y="200"/><di:waypoint x="550" y="200"/><di:waypoint x="550" y="196"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F6_di" bpmnElement="F6"><di:waypoint x="600" y="196"/><di:waypoint x="625" y="196"/><di:waypoint x="625" y="95"/><di:waypoint x="650" y="95"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F7_di" bpmnElement="F7"><di:waypoint x="720" y="130"/><di:waypoint x="720" y="165"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F8_di" bpmnElement="F8"><di:waypoint x="790" y="305"/><di:waypoint x="858" y="305"/><di:waypoint x="858" y="214"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F9_di" bpmnElement="F9"><di:waypoint x="265" y="221"/><di:waypoint x="265" y="305"/><di:waypoint x="350" y="305"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F10_di" bpmnElement="F10"><di:waypoint x="500" y="305"/><di:waypoint x="575" y="305"/><di:waypoint x="575" y="221"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="F11_di" bpmnElement="F11"><di:waypoint x="790" y="200"/><di:waypoint x="815" y="200"/><di:waypoint x="815" y="240"/><di:waypoint x="790" y="240"/><di:waypoint x="790" y="270"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

(async () => {
  const [john, jane, bob, admin] = await Promise.all([
    login('john@bpms.local', 'user123'),
    login('jane@bpms.local', 'user123'),
    login('bob@bpms.local', 'user123'),
    login('admin@bpms.local', 'admin123'),
  ]);
  const users = asList(await api(admin, '/users'));
  const U = Object.fromEntries(users.map((u) => [u.email.split('@')[0], u]));

  const proc = asList(await api(john, '/processes')).find((p) => p.name === 'فرآیند درخواست مرخصی');
  if (!proc) throw new Error('Persian process not found');

  const submitForm = { employeeName: 'علی رضایی', startDate: '2026-09-10', endDate: '2026-09-12', reason: 'تست' };

  // -----------------------------------------------------------------------
  // 1a. Annual — approval anchored to the performer of «ثبت درخواست مرخصی»
  // -----------------------------------------------------------------------
  {
    const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
    const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'submit(john)');
    check(submit.assignee?.email === 'john@bpms.local', 'FIXED_USER entry task', 'registration task assigned to the configured user (john)');
    await api(john, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Annual' } }) });
    const approve = await waitForTask(jane, (t) => t.name === 'تایید مدیر مستقیم' && t.processInstanceId === inst.id, 'manager(jane)');
    check(approve.assignee?.email === 'jane@bpms.local', 'TASK_STARTER_MANAGER', `approval anchored to performer of «ثبت» (john) → his manager jane — task-scoped, not process starter`);
    await api(jane, `/tasks/${approve.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { decision: 'تایید' } }) });
    const notify = await waitForTask(john, (t) => t.name === 'اطلاع‌رسانی نتیجه' && t.processInstanceId === inst.id, 'notify(john)');
    check(notify.assignee?.email === 'john@bpms.local', 'TASK_STARTER notify-back', 'notification went to the performer of «ثبت درخواست مرخصی» (john)');
    await api(john, `/tasks/${notify.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { notifyMethod: 'ایمیل' } }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await api(john, `/process-instances/${inst.id}`);
    check(after.status === 'COMPLETED', 'annual full path', `instance status=${after.status}`);
  }

  // -----------------------------------------------------------------------
  // 1b. Sick — approval tasks skipped, branch goes straight to auto-approve
  //     end event (no notify task on this branch — regression check)
  // -----------------------------------------------------------------------
  {
    const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
    const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'submit(john)');
    await api(john, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Sick' } }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await api(john, `/process-instances/${inst.id}`);
    const janeTasks = asList(await api(jane, '/tasks/mine')).filter((t) => t.processInstanceId === inst.id);
    const bobTasks = asList(await api(bob, '/tasks/mine')).filter((t) => t.processInstanceId === inst.id);
    check(after.status === 'COMPLETED' && janeTasks.length === 0 && bobTasks.length === 0, 'sick auto-approve', `status=${after.status}, jane tasks=${janeTasks.length}, bob tasks=${bobTasks.length}`);
  }

  // -----------------------------------------------------------------------
  // 1c. Unpaid — POSITION pool (bob) regression
  // -----------------------------------------------------------------------
  {
    const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
    const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'submit(john)');
    await api(john, `/tasks/${submit.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { ...submitForm, leaveType: 'Unpaid' } }) });
    const approve = await waitForTask(bob, (t) => t.name === 'تایید منابع انسانی' && t.processInstanceId === inst.id, 'hr(bob)');
    check(!!approve, 'POSITION', 'unpaid request routed to the HR manager position (bob)');
    await api(bob, `/tasks/${approve.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { decision: 'رد' } }) });
    const notify = await waitForTask(john, (t) => t.name === 'اطلاع‌رسانی نتیجه' && t.processInstanceId === inst.id, 'notify(john)');
    await api(john, `/tasks/${notify.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { notifyMethod: 'پیامک' } }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await api(john, `/process-instances/${inst.id}`);
    check(after.status === 'COMPLETED', 'unpaid full path', `instance status=${after.status}`);
  }

  // -----------------------------------------------------------------------
  // 2. Server-side guardrails
  // -----------------------------------------------------------------------
  {
    const tryPut = async (assignments) => {
      try {
        await api(admin, `/processes/${proc.id}/assignments`, { method: 'PUT', body: JSON.stringify({ assignments }) });
        return null;
      } catch (e) {
        return e.status || null;
      }
    };
    let s = await tryPut([{ taskName: 'تایید مدیر مستقیم', strategy: 'TASK_STARTER_MANAGER' }]);
    check(s === 400, 'guardrail: sourceTaskName required', `PUT without sourceTaskName → ${s}`);
    s = await tryPut([{ taskName: 'تایید مدیر مستقیم', strategy: 'TASK_STARTER', sourceTaskName: 'تایید مدیر مستقیم' }]);
    check(s === 400, 'guardrail: source ≠ self', `PUT with sourceTaskName == taskName → ${s}`);
    s = await tryPut([{ taskName: 'تایید مدیر مستقیم', strategy: 'INITIATOR_MANAGER' }]);
    check(s === 400, 'guardrail: legacy strategy rejected', `PUT with INITIATOR_MANAGER → ${s}`);
  }

  // -----------------------------------------------------------------------
  // 3. Multi-starter synthetic process — MANY task starters, MANY routings,
  //    all inside ONE instance (the exact scenario the user asked for)
  // -----------------------------------------------------------------------
  {
    const NAME = 'فرآیند نمونه تخصیص چندمدیریتی';
    let multi = asList(await api(admin, '/processes')).find((p) => p.name === NAME);
    if (!multi) {
      multi = await api(admin, '/processes', { method: 'POST', body: JSON.stringify({ name: NAME, description: 'هر گام تایید به مدیرِ انجام‌دهندهٔ وظیفهٔ مبدأ خودش می‌رود', bpmnXml: MULTI_XML }) });
    } else {
      await api(admin, `/processes/${multi.id}`, { method: 'PATCH', body: JSON.stringify({ bpmnXml: MULTI_XML }) });
    }
    await api(admin, `/processes/${multi.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) });
    await api(admin, `/processes/${multi.id}/assignments`, {
      method: 'PUT',
      body: JSON.stringify({
        assignments: [
          { taskName: 'ثبت درخواست مهندسی', strategy: 'FIXED_USER', assigneeId: U.john.id },
          { taskName: 'ثبت درخواست مالی', strategy: 'FIXED_USER', assigneeId: U.bob.id },
          { taskName: 'ثبت درخواست اداری', strategy: 'FIXED_USER', assigneeId: U.admin.id },
          { taskName: 'تایید مهندسی', strategy: 'TASK_STARTER_MANAGER', sourceTaskName: 'ثبت درخواست مهندسی' },
          { taskName: 'تایید اداری', strategy: 'TASK_STARTER_MANAGER', sourceTaskName: 'ثبت درخواست اداری' },
          { taskName: 'ارجاع مالی', strategy: 'TASK_STARTER', sourceTaskName: 'ثبت درخواست مالی' },
        ],
      }),
    });

    const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: multi.id }) });
    const tEng = await waitForTask(john, (t) => t.name === 'ثبت درخواست مهندسی' && t.processInstanceId === inst.id, 'eng(john)');
    const tFin = await waitForTask(bob, (t) => t.name === 'ثبت درخواست مالی' && t.processInstanceId === inst.id, 'fin(bob)');
    const tAdm = await waitForTask(admin, (t) => t.name === 'ثبت درخواست اداری' && t.processInstanceId === inst.id, 'adm(admin)');
    await api(admin, `/tasks/${tAdm.id}/complete`, { method: 'POST', body: JSON.stringify({ data: {} }) });
    await api(john, `/tasks/${tEng.id}/complete`, { method: 'POST', body: JSON.stringify({ data: {} }) });
    await api(bob, `/tasks/${tFin.id}/complete`, { method: 'POST', body: JSON.stringify({ data: {} }) });

    const engAp = await waitForTask(jane, (t) => t.name === 'تایید مهندسی' && t.processInstanceId === inst.id, 'engAp(jane)');
    check(engAp.assignee?.email === 'jane@bpms.local', 'multi: manager of john task', 'تایید مهندسی → jane (manager of «ثبت مهندسی» performer)');

    await api(jane, `/tasks/${engAp.id}/complete`, { method: 'POST', body: JSON.stringify({ data: {} }) });
    const admAp = await waitForTask(admin, (t) => t.name === 'تایید اداری' && t.processInstanceId === inst.id, 'admAp(admin)');
    check(admAp.assignee?.email === 'admin@bpms.local', 'multi: no-manager fallback', 'تایید اداری → admin (performer has no position → first-ADMIN fallback)');

    await api(admin, `/tasks/${admAp.id}/complete`, { method: 'POST', body: JSON.stringify({ data: {} }) });
    const finRef = await waitForTask(bob, (t) => t.name === 'ارجاع مالی' && t.processInstanceId === inst.id, 'finRef(bob)');
    check(finRef.assignee?.email === 'bob@bpms.local', 'multi: performer of bob task', 'ارجاع مالی → bob (TASK_STARTER of «ثبت مالی»)');

    await api(bob, `/tasks/${finRef.id}/complete`, { method: 'POST', body: JSON.stringify({ data: {} }) });
    await new Promise((r) => setTimeout(r, 1500));
    const after = await api(admin, `/process-instances/${inst.id}`);
    check(after.status === 'COMPLETED', 'multi-starter full path', `one instance → three different routings from three different task starters — status=${after.status}`);
  }

  console.log(failures === 0 ? '\n🎉 ALL TASK-STARTER ASSIGNMENT E2E TESTS PASSED' : `\n💥 ${failures} test(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
