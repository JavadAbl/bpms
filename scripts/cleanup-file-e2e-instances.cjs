/** One-off cleanup: close instances left over from file-upload testing. */
const API = 'http://localhost:3001/api';
const login = async (email, password) => {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return (await r.json()).accessToken;
};
const api = async (t, path, opts = {}) => {
  const r = await fetch(`${API}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json().catch(() => ({}));
};
const list = (d) => (Array.isArray(d) ? d : d.items || d.data || []);

(async () => {
  const [john, jane, admin] = await Promise.all([
    login('john@bpms.local', 'user123'),
    login('jane@bpms.local', 'user123'),
    login('admin@bpms.local', 'admin123'),
  ]);
  const mine = async (t) => list(await api(t, '/tasks/mine')).filter((x) => x.status === 'PENDING');

  // jane's pending approvals
  const approvals = await mine(jane);
  for (const a of approvals) {
    console.log('approval pending:', a.id, a.processInstanceId);
    if (a.name === 'تایید مدیر مستقیم') {
      await api(jane, `/tasks/${a.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { decision: 'تایید', comment: 'پس از بررسی پیوست‌ها' } }) });
      console.log(' → completed approval');
    }
  }
  // any other pending tasks (e.g. تایید منابع انسانی) — terminate their instances instead
  for (const t of [...(await mine(jane)), ...(await mine(john)), ...(await mine(admin))]) {
    await api(admin, `/process-instances/${t.processInstanceId}/terminate`, { method: 'POST', body: JSON.stringify({}) }).catch((e) => console.log('terminate skip:', e.message));
    console.log(' → terminated instance', t.processInstanceId);
  }
  // john's pending notifications after the approvals above
  for (const n of await mine(john)) {
    if (n.name === 'اطلاع‌رسانی نتیجه') {
      await api(john, `/tasks/${n.id}/complete`, { method: 'POST', body: JSON.stringify({ data: { notifyMethod: 'ایمیل' } }) });
      console.log(' → completed notify', n.id);
    }
  }
  console.log('cleanup done');
})().catch((e) => { console.error('cleanup failed:', e.message); process.exit(1); });
