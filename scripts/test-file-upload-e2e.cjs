/**
 * E2E test — file attachments in forms:
 *   - POST /api/files (multipart) → meta {id, name, size, mimeType}
 *   - submit task with attachments array in form data
 *   - files stamped with taskId/instanceId server-side
 *   - next task's instanceVariables carry the metas (readOnly mirror shows them)
 *   - next user downloads via GET /api/files/:id — bytes identical
 *   - GET /api/files/by-instance/:instanceId lists all attachments
 *   - guardrails: 401 without token, 404 unknown id, 413 oversize
 */
const API = 'http://localhost:3001/api';
const UPLOADS_DIR = '/home/z/my-project/mini-services/bpms-backend/uploads';
const fs = require('fs');

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
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
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

(async () => {
  const [john, jane] = await Promise.all([
    login('john@bpms.local', 'user123'),
    login('jane@bpms.local', 'user123'),
  ]);

  const proc = asList(await api(john, '/processes')).find((p) => p.name === 'فرآیند درخواست مرخصی');
  if (!proc) throw new Error('Persian process not found');

  // --- upload 2 files as john (one Persian name, one pdf-like) -------------
  const doc1Bytes = Buffer.from('گزارش پزشک — تست بارگذاری فایل BPMS 🏥', 'utf8');
  const doc2Bytes = Buffer.concat([Buffer.from('%PDF-1.4 test attachment\n'), Buffer.from('x'.repeat(2048))]);
  const fd1 = new FormData();
  fd1.append('file', new Blob([doc1Bytes], { type: 'text/plain' }), 'گواهی پزشک.txt');
  const fd2 = new FormData();
  fd2.append('file', new Blob([doc2Bytes], { type: 'application/pdf' }), 'report.pdf');

  const meta1 = await api(john, '/files', { method: 'POST', body: fd1 });
  const meta2 = await api(john, '/files', { method: 'POST', body: fd2 });
  check(meta1.name === 'گواهی پزشک.txt' && meta1.size === doc1Bytes.length, 'upload keeps UTF-8 name + size', `name="${meta1.name}", size=${meta1.size}`);
  check(meta2.name === 'report.pdf', 'second upload ok', `id=${meta2.id}`);

  // files exist on disk with sanitized extensions
  const diskFiles = fs.existsSync(UPLOADS_DIR) ? fs.readdirSync(UPLOADS_DIR) : [];
  check(diskFiles.some((f) => f.endsWith('.txt')) && diskFiles.some((f) => f.endsWith('.pdf')), 'bytes stored on disk (uuid + ext)', diskFiles.slice(-3).join(', '));

  // --- start instance, submit with attachments -----------------------------
  const inst = await api(john, '/process-instances', { method: 'POST', body: JSON.stringify({ processId: proc.id }) });
  const submit = await waitForTask(john, (t) => t.name === 'ثبت درخواست مرخصی' && t.processInstanceId === inst.id, 'submit(john)');
  await api(john, `/tasks/${submit.id}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        employeeName: 'علی رضایی', startDate: '2026-09-10', endDate: '2026-09-12',
        reason: 'پیوست دارد', leaveType: 'Annual',
        attachments: [meta1, meta2],
      },
    }),
  });

  // --- stamping -------------------------------------------------------------
  const stamped = asList(await api(john, `/files/by-instance/${inst.id}`));
  check(stamped.length === 2 && stamped.every((f) => f.taskId === submit.id && f.instanceId === inst.id), 'files stamped with task/instance', stamped.map((f) => `${f.originalName}→task:${!!f.taskId}`).join(', '));
  check(stamped.every((f) => f.submittedBy?.email === 'john@bpms.local'), 'uploader recorded', stamped.map((f) => f.submittedBy?.name).join(', '));

  // --- next task sees the metas via instanceVariables -----------------------
  const approve = await waitForTask(jane, (t) => t.name === 'تایید مدیر مستقیم' && t.processInstanceId === inst.id, 'approve(jane)');
  const detail = await api(jane, `/tasks/${approve.id}`);
  const mirrorVars = detail.instanceVariables?.attachments;
  check(Array.isArray(mirrorVars) && mirrorVars.length === 2 && mirrorVars[0].name === 'گواهی پزشک.txt', 'approval task prefill carries attachment metas', JSON.stringify(mirrorVars?.map((m) => m.name)));

  // --- jane downloads john's file — bytes identical -------------------------
  const dl = await fetch(`${API}/files/${meta1.id}`, { headers: { Authorization: `Bearer ${jane}` } });
  const downloaded = Buffer.from(await dl.arrayBuffer());
  check(Buffer.compare(downloaded, doc1Bytes) === 0, 'downloaded bytes identical', `${downloaded.length} bytes (original ${doc1Bytes.length})`);

  // --- guardrails -----------------------------------------------------------
  let s;
  try { await fetch(`${API}/files/${meta1.id}`).then((r) => { if (!r.ok) throw Object.assign(new Error(), { status: r.status }); }); s = null; } catch (e) { s = e.status; }
  check(s === 401, 'download without token → 401', `status=${s}`);
  try { await api(jane, '/files/00000000-0000-4000-8000-000000000000'); s = null; } catch (e) { s = e.status; }
  check(s === 404, 'download unknown id → 404', `status=${s}`);
  const bigBuf = Buffer.alloc(11 * 1024 * 1024, 7);
  const fdBig = new FormData();
  fdBig.append('file', new Blob([bigBuf], { type: 'text/plain' }), 'big.txt');
  try { await api(john, '/files', { method: 'POST', body: fdBig }); s = null; } catch (e) { s = e.status; }
  check(s === 413 || s === 400, 'oversize upload rejected', `status=${s}`);

  // --- complete the flow so the instance is not left running ----------------
  await api(jane, `/tasks/${approve.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { decision: 'تایید' } }) });
  const notify = await waitForTask(john, (t) => t.name === 'اطلاع‌رسانی نتیجه' && t.processInstanceId === inst.id, 'notify(john)');
  await api(john, `/tasks/${notify.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { notifyMethod: 'ایمیل' } }) });
  await new Promise((r) => setTimeout(r, 1500));
  const after = await api(john, `/process-instances/${inst.id}`);
  check(after.status === 'COMPLETED', 'flow completes with attachments present', `status=${after.status}`);

  console.log(failures === 0 ? '\n🎉 ALL FILE-ATTACHMENT E2E TESTS PASSED' : `\n💥 ${failures} test(s) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
