#!/usr/bin/env node
/**
 * E2E test: save-time gateway-condition validation (backend gate).
 *
 *  1. login as admin
 *  2. POST /processes with 4 broken-XML variants  → each MUST be rejected 400
 *     a) syntax-error JS body      (language=javascript, body has a typo)
 *     b) missing language attr     (classic bpmn-js template → always-first-branch bug)
 *     c) javascript body w/o next( → gateway would hang
 *     d) empty conditionExpression → garbage
 *  3. POST /processes with valid XML (next-wrapped, language=javascript) → 201
 *  4. PATCH status=ACTIVE on the valid process → 200 (activation gate passes)
 *  5. PATCH bpmnXml with a broken condition → 400 (update gate)
 *  6. DELETE the test process
 *
 * Run: node scripts/test-condition-validation.cjs
 */

const BASE = process.env.BACKEND_BASE || 'http://localhost:3001/api';

function xmlFor(conditionMarkup) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Defs_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="P_test" isExecutable="true">
    <bpmn:startEvent id="Start_1"><bpmn:outgoing>Flow_a</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="Fill"><bpmn:incoming>Flow_a</bpmn:incoming><bpmn:outgoing>Flow_g</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="Gw_1" name="Route"><bpmn:incoming>Flow_g</bpmn:incoming><bpmn:outgoing>Flow_bad</bpmn:outgoing><bpmn:outgoing>Flow_end</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_2" name="Branch A"><bpmn:incoming>Flow_bad</bpmn:incoming></bpmn:userTask>
    <bpmn:endEvent id="End_1"><bpmn:incoming>Flow_end</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_a" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_g" sourceRef="Task_1" targetRef="Gw_1" />
    <bpmn:sequenceFlow id="Flow_bad" name="to branch A" sourceRef="Gw_1" targetRef="Task_2">${conditionMarkup}</bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_end" name="to end" sourceRef="Gw_1" targetRef="End_1" />
  </bpmn:process>
</bpmn:definitions>`;
}

const CASES = [
  {
    name: 'syntax-error JS body',
    xml: xmlFor(
      `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.x ==== 'Sick')</bpmn:conditionExpression>`,
    ),
    expectReject: true,
  },
  {
    name: 'missing language attr (template trap)',
    xml: xmlFor(
      `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression">\${leaveType == 'Sick'}</bpmn:conditionExpression>`,
    ),
    expectReject: true,
  },
  {
    name: 'javascript body without next() call',
    xml: xmlFor(
      `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">environment.variables.x == 'Sick'</bpmn:conditionExpression>`,
    ),
    expectReject: true,
  },
  {
    name: 'empty self-closing condition',
    xml: xmlFor(`<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript" />`),
    expectReject: true,
  },
  {
    name: 'VALID next-wrapped condition',
    xml: xmlFor(
      `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.leaveType == 'Sick')</bpmn:conditionExpression>`,
    ),
    expectReject: false,
  },
  {
    name: 'VALID no condition at all',
    xml: xmlFor(''),
    expectReject: false,
  },
];

async function main() {
  // ---- login
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bpms.local', password: 'admin123' }),
  });
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
  const { accessToken } = await loginRes.json();
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` };

  let passed = 0;
  let failed = 0;

  // ---- create-gate cases
  for (const c of CASES) {
    const res = await fetch(`${BASE}/processes`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: `[cond-test] ${c.name}`, bpmnXml: c.xml }),
    });
    const body = await res.json().catch(() => ({}));
    const rejected = res.status === 400;
    const ok = rejected === c.expectReject;
    if (ok) passed++;
    else failed++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  [create] ${c.name} → HTTP ${res.status}` +
        (res.status !== 201 ? `  msg: ${String(body.message || '').split('\n')[1] || body.message || ''}` : `  id: ${body.id}`),
    );
    if (res.status === 201) {
      // remember the last created process for the update/activation tests
      var created = body;
    }
  }

  // ---- activation + update gates on the valid process
  if (created) {
    // activate the valid process → should pass
    const actRes = await fetch(`${BASE}/processes/${created.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    const ok1 = actRes.status === 200;
    ok1 ? passed++ : failed++;
    console.log(`${ok1 ? 'PASS' : 'FAIL'}  [activate] valid process → HTTP ${actRes.status}`);

    // now try to save broken XML into the ACTIVE process → 400
    const broken = xmlFor(
      `<bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.x ====)</bpmn:conditionExpression>`,
    );
    const updRes = await fetch(`${BASE}/processes/${created.id}`, {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ bpmnXml: broken }),
    });
    const ok2 = updRes.status === 400;
    ok2 ? passed++ : failed++;
    const ub = await updRes.json().catch(() => ({}));
    console.log(
      `${ok2 ? 'PASS' : 'FAIL'}  [update] broken XML into existing process → HTTP ${updRes.status}` +
        (ok2 ? `  msg: ${String(ub.message || '').split('\n')[1] || ''}` : ''),
    );

    // cleanup
    const delRes = await fetch(`${BASE}/processes/${created.id}`, { method: 'DELETE', headers: auth });
    console.log(`${delRes.status === 200 ? 'PASS' : 'FAIL'}  [cleanup] deleted test process → HTTP ${delRes.status}`);
    delRes.status === 200 ? passed++ : failed++;
  } else {
    console.log('SKIP  [activate/update] no valid process was created');
  }

  console.log(`\n===== ${passed} passed, ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Test run error:', e.message);
  process.exit(1);
});
