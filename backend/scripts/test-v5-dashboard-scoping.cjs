#!/usr/bin/env node
/**
 * E2E verification for the v5 dashboard scoping (run against LIVE backend :3001):
 *
 *  "In the dashboard the users should see their own data; only admin sees all."
 *
 *  1. Baseline KPI snapshot for admin/john/jane (DB has 1 unrestricted seeded process).
 *  2. Admin creates a RESTRICTED process (starter = jane only, minimal BPMN, no
 *     task assignment → first task stays "open"/unassigned).
 *     - activeProcesses: john must NOT count it; jane must; admin counts globally.
 *  3. Jane starts the restricted instance:
 *     - runningInstances/recent: jane sees it (starter), john does NOT, admin sees all.
 *  4. Terminate the instance → status TERMINATED; scopes re-checked (group counts).
 *  5. Cleanup: DELETE the test process, verify counts return to baseline.
 *  6. Guardrail: non-admin still forbidden on the global report (GET /process-instances).
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

const MINIMAL_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DC" id="Defs_v5" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Proc_v5" isExecutable="true">
    <bpmn:startEvent id="Start_1" name="شروع"><bpmn:outgoing>Flow_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="کار تست داشبورد"><bpmn:incoming>Flow_1</bpmn:incoming><bpmn:outgoing>Flow_2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="End_1" name="پایان"><bpmn:incoming>Flow_2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diag_v5"><bpmndi:BPMNPlane id="Plane_v5" bpmnElement="Proc_v5">
    <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="150" y="90" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="240" y="70" width="100" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1"><dc:Bounds x="390" y="90" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="186" y="108" /><di:waypoint x="240" y="108" /></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="340" y="110" /><di:waypoint x="390" y="108" /></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

async function main() {
  const admin = await login('admin@bpms.local', 'admin123');
  const john = await login('john@bpms.local', 'user123');
  const jane = await login('jane@bpms.local', 'user123');
  const users = await api(admin.accessToken, '/users');
  const janeId = users.body.find((u) => u.email === 'jane@bpms.local').id;
  const johnId = users.body.find((u) => u.email === 'john@bpms.local').id;

  const dash = async (tok) => (await api(tok, '/dashboard')).body;

  console.log('\n— 1) baseline KPIs —');
  const baseAdmin = await dash(admin.accessToken);
  const baseJohn = await dash(john.accessToken);
  const baseJane = await dash(jane.accessToken);
  ok(baseAdmin.activeProcesses >= 1, `admin baseline activeProcesses ≥ 1 (${baseAdmin.activeProcesses})`);
  ok(
    baseJohn.activeProcesses === baseJane.activeProcesses,
    `john/jane baseline equal (${baseJohn.activeProcesses})`,
  );

  console.log('\n— 2) restricted process changes process scope only for entitled users —');
  const created = await api(admin.accessToken, '/processes', {
    method: 'POST',
    body: JSON.stringify({
      name: 'فرآیند تست داشبورد v5',
      description: 'scoped KPI test — please ignore',
      bpmnXml: MINIMAL_BPMN,
      starterIds: [janeId],
    }),
  });
  ok(created.status === 201, `POST /processes (restricted) → 201`, JSON.stringify(created.body).slice(0, 200));
  const procId = created.body?.id;

  // New definitions start as DRAFT — activate it so it counts / can start
  const activated = await api(admin.accessToken, `/processes/${procId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ACTIVE' }),
  });
  ok(activated.status === 200 && activated.body?.status === 'ACTIVE', `PATCH activate → ACTIVE (${activated.status})`);

  const dAdmin = await dash(admin.accessToken);
  const dJohn = await dash(john.accessToken);
  const dJane = await dash(jane.accessToken);
  ok(
    dAdmin.activeProcesses === baseAdmin.activeProcesses + 1,
    `admin counts the new process globally (${baseAdmin.activeProcesses} → ${dAdmin.activeProcesses})`,
  );
  ok(
    dJohn.activeProcesses === baseJohn.activeProcesses,
    `john does NOT count the restricted process (${dJohn.activeProcesses})`,
  );
  ok(
    dJane.activeProcesses === baseJane.activeProcesses + 1,
    `jane (starter) counts it (${baseJane.activeProcesses} → ${dJane.activeProcesses})`,
  );

  console.log('\n— 3) instance scoping (start as jane) —');
  const started = await api(jane.accessToken, '/process-instances', {
    method: 'POST',
    body: JSON.stringify({ processId: procId }),
  });
  ok(started.status === 201, `jane starts the restricted instance → 201`, JSON.stringify(started.body).slice(0, 160));
  const instId = started.body?.id;

  const iJohn = await dash(john.accessToken);
  const iJane = await dash(jane.accessToken);
  const iAdmin = await dash(admin.accessToken);
  ok(iJane.runningInstances === baseJane.runningInstances + 1, `jane sees her new RUNNING instance (${iJane.runningInstances})`);
  ok(iJohn.runningInstances === baseJohn.runningInstances, `john does NOT see jane's instance (${iJohn.runningInstances})`);
  ok(iAdmin.runningInstances === baseAdmin.runningInstances + 1, `admin sees it globally (${iAdmin.runningInstances})`);
  ok(
    iJane.recentInstances.some((i) => i.id === instId),
    'jane recentInstances includes the new instance',
  );
  ok(
    !iJohn.recentInstances.some((i) => i.id === instId),
    "john recentInstances excludes jane's instance",
  );
  ok(
    iJane.instancesByStatus.RUNNING === (baseJane.instancesByStatus.RUNNING ?? 0) + 1,
    `jane instancesByStatus.RUNNING +1 (${iJane.instancesByStatus.RUNNING})`,
  );

  console.log('\n— 4) terminate → TERMINATED bucket, scope preserved —');
  const term = await api(jane.accessToken, `/process-instances/${instId}/terminate`, { method: 'POST' });
  ok(term.status === 201 || term.status === 200, `jane terminates her instance (${term.status})`);

  const tJane = await dash(jane.accessToken);
  const tJohn = await dash(john.accessToken);
  ok(
    tJane.runningInstances === baseJane.runningInstances,
    `jane RUNNING back to baseline (${tJane.runningInstances})`,
  );
  ok(
    tJane.instancesByStatus.TERMINATED === (baseJane.instancesByStatus.TERMINATED ?? 0) + 1,
    `jane TERMINATED +1 (${tJane.instancesByStatus.TERMINATED})`,
  );
  ok(
    (tJohn.instancesByStatus.TERMINATED ?? 0) === (baseJohn.instancesByStatus.TERMINATED ?? 0),
    `john TERMINATED unchanged (${tJohn.instancesByStatus.TERMINATED ?? 0})`,
  );

  console.log('\n— 5) cleanup (deactivate; the runner re-seeds for a pristine DB) —');
  // DELETE would 500 on the FK from the terminated instance (pre-existing
  // behavior: processes with instances are not deletable). Deactivating
  // removes it from every ACTIVE-scope count, then `prisma db seed` resets.
  const deact = await api(admin.accessToken, `/processes/${procId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'DRAFT' }),
  });
  ok(deact.status === 200, `PATCH deactivate (${deact.status})`);
  const endJohn = await dash(john.accessToken);
  const endJane = await dash(jane.accessToken);
  const endAdmin = await dash(admin.accessToken);
  ok(
    endJohn.activeProcesses === baseJohn.activeProcesses &&
      endJane.activeProcesses === baseJane.activeProcesses &&
      endAdmin.activeProcesses === baseAdmin.activeProcesses,
    `all activeProcesses back to baseline (john ${endJohn.activeProcesses}, jane ${endJane.activeProcesses}, admin ${endAdmin.activeProcesses})`,
  );

  console.log('\n— 6) guardrails —');
  const globalReport = await api(john.accessToken, '/process-instances');
  ok(globalReport.status === 403, `non-admin still blocked from the global report (${globalReport.status})`);
  const mine = await api(john.accessToken, '/process-instances/mine');
  ok(mine.status === 200, `john /process-instances/mine works (${mine.status})`);
  const johnStart = await api(john.accessToken, '/processes', {
    method: 'POST',
    body: JSON.stringify({
      name: 'x',
      bpmnXml: MINIMAL_BPMN,
      starterIds: [johnId],
    }),
  });
  ok(johnStart.status === 403, `non-admin cannot create processes (${johnStart.status})`);

  console.log(`\n========================================\nRESULT: ${pass} pass, ${fail} fail\n========================================`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
