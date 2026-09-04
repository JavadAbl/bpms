/**
 * E2E test — process versioning (immutable history + restore-as-append):
 *   - create → v1 row
 *   - XML change → new version; name-only / identical-XML saves → NO new version
 *   - versions list metadata (isCurrent, author, note)
 *   - restore v1 → appended as NEW current version (history never rewritten)
 *   - in-flight instance keeps running on ITS OWN snapshot while current moves on
 *   - guardrails: restore of already-current → 400; unknown version → 404;
 *     restore by non-admin → 403
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

const xml = (label) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="defs-ver" targetNamespace="http://bpms.local/bpms">
  <bpmn:process id="ver-proc" isExecutable="true" name="${label}">
    <bpmn:startEvent id="Start_1" name="شروع"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="کار بررسی"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="End_1" name="پایان"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="Start_1" targetRef="Task_1"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Task_1" targetRef="End_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="DI_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="ver-proc">
    <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="160" y="180" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds x="250" y="158" width="120" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1"><dc:Bounds x="420" y="180" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="F1_di" bpmnElement="F1"><di:waypoint x="196" y="198"/><di:waypoint x="250" y="198"/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="F2_di" bpmnElement="F2"><di:waypoint x="370" y="198"/><di:waypoint x="420" y="198"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const XML_A = xml('نسخه الف');
const XML_B = xml('نسخه ب');

(async () => {
  const [john, admin] = await Promise.all([
    login('john@bpms.local', 'user123'),
    login('admin@bpms.local', 'admin123'),
  ]);
  const users = asList(await api(admin, '/users'));
  const johnId = users.find((u) => u.email === 'john@bpms.local').id;

  // --- create → v1 ---------------------------------------------------------
  const NAME = 'فرآیند تست نسخه‌بندی';
  let proc = asList(await api(admin, '/processes')).find((p) => p.name === NAME);
  if (proc) proc = await api(admin, `/processes/${proc.id}`, { method: 'PATCH', body: JSON.stringify({ bpmnXml: XML_A, status: 'DRAFT' }) });
  else proc = await api(admin, '/processes', { method: 'POST', body: JSON.stringify({ name: NAME, description: 'تاریخچه نسخه‌ها', bpmnXml: XML_A }) });
  check(proc.version === 1, 'create → v1', `version=${proc.version}`);

  // --- XML change → v2; name-only → still v2; identical XML → still v2 -----
  proc = await api(admin, `/processes/${proc.id}`, { method: 'PATCH', body: JSON.stringify({ bpmnXml: XML_B, note: 'تغییر برچسب نسخه' }) });
  check(proc.version === 2, 'XML change → v2', `version=${proc.version}`);
  proc = await api(admin, `/processes/${proc.id}`, { method: 'PATCH', body: JSON.stringify({ name: NAME + ' ' }) });
  check(proc.version === 2, 'name-only save → no version', `version=${proc.version}`);
  proc = await api(admin, `/processes/${proc.id}`, { method: 'PATCH', body: JSON.stringify({ bpmnXml: XML_B }) });
  check(proc.version === 2, 'identical XML save → no version', `version=${proc.version}`);

  // --- versions list -------------------------------------------------------
  let versions = asList(await api(john, `/processes/${proc.id}/versions`));
  check(versions.length === 2 && versions[0].version === 2, 'versions list newest-first', versions.map((v) => `v${v.version}${v.isCurrent ? '*' : ''}`).join(', '));
  check(versions[0].isCurrent === true && versions[1].isCurrent === false, 'isCurrent flags', `v2=${versions[0].isCurrent}, v1=${versions[1].isCurrent}`);
  check(versions[0].note === 'تغییر برچسب نسخه' && versions[0].createdBy?.name, 'note + author stored', `note="${versions[0].note}", by=${versions[0].createdBy?.name}`);
  const v1xml = await api(john, `/processes/${proc.id}/versions/1`);
  check(v1xml.bpmnXml === XML_A, 'version detail returns exact v1 XML', `len=${v1xml.bpmnXml.length}`);

  // --- start instance on v2, then restore v1 → v3 (append, not rewrite) ----
  await api(admin, `/processes/${proc.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ACTIVE' }) });
  await api(admin, `/processes/${proc.id}/assignments`, { method: 'PUT', body: JSON.stringify({ assignments: [{ taskName: 'کار بررسی', strategy: 'FIXED_USER', assigneeId: johnId }] }) });
  const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
  const task = await waitForTask(john, (t) => t.name === 'کار بررسی' && t.processInstanceId === inst.id, 'review task');

  proc = await api(admin, `/processes/${proc.id}/versions/1/restore`, { method: 'POST', body: JSON.stringify({ note: 'بازگشت به نسخه الف' }) });
  check(proc.version === 3 && proc.bpmnXml === XML_A, 'restore v1 → appended as v3', `version=${proc.version}, xml===v1`);
  versions = asList(await api(admin, `/processes/${proc.id}/versions`));
  check(versions.length === 3, 'history kept all 3 versions', versions.map((v) => `v${v.version}`).join(', '));

  // --- running instance continues on ITS OWN v2 snapshot -------------------
  await api(john, `/tasks/${task.id}/complete`, { method: 'POST', body: JSON.stringify({ data: {} }) });
  await new Promise((r) => setTimeout(r, 1500));
  const after = await api(john, `/process-instances/${inst.id}`);
  check(after.status === 'COMPLETED', 'in-flight instance pinned to its snapshot', `started on v2, current is v3, instance status=${after.status}`);

  // --- guardrails ----------------------------------------------------------
  let s;
  try { await api(admin, `/processes/${proc.id}/versions/3/restore`, { method: 'POST', body: JSON.stringify({}) }); s = null; } catch (e) { s = e.status; }
  check(s === 400, 'restore already-current → 400', `status=${s}`);
  try { await api(admin, `/processes/${proc.id}/versions/99`, { method: 'GET' }); s = null; } catch (e) { s = e.status; }
  check(s === 404, 'unknown version → 404', `status=${s}`);
  try { await api(john, `/processes/${proc.id}/versions/1/restore`, { method: 'POST', body: JSON.stringify({}) }); s = null; } catch (e) { s = e.status; }
  check(s === 403, 'restore by non-admin → 403', `status=${s}`);

  console.log(failures === 0 ? '\n🎉 ALL PROCESS-VERSIONING E2E TESTS PASSED' : `\n💥 ${failures} test(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
