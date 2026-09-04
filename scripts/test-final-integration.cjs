// Final integration check: execute the ACTUAL persisted Leave Approval XML through bpmn-engine
// and verify gateway conditions route correctly (sick → auto-approve, other → approve request).
const { Engine } = require('/home/z/my-project/mini-services/bpms-backend/node_modules/bpmn-engine');

async function fetchXml() {
  // Login to backend directly
  const login = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bpms.local', password: 'admin123' }),
  });
  const { accessToken } = await login.json();
  const list = await (await fetch('http://localhost:3001/api/processes', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })).json();
  const proc = (Array.isArray(list) ? list : list.data || []).find((p) => p.name === 'Leave Approval');
  const full = await (await fetch(`http://localhost:3001/api/processes/${proc.id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })).json();
  return full.bpmnXml || full.data?.bpmnXml;
}

function run(xml, variables, label) {
  return new Promise((resolve, reject) => {
    const taken = [];
    const engine = Engine({ name: `final-${label}`, source: xml });
    const listener = new (require('events').EventEmitter)();
    listener.on('activity.end', (api) => {
      if (api.type === 'bpmn:EndEvent') taken.push(api.content.name || api.id);
    });
    listener.on('wait', (api) => {
      if (api.environment && variables) Object.assign(api.environment.variables, variables);
      api.signal(variables);
    });
    listener.on('error', (err) => reject(err));
    engine.execute({ listener }, (err) => { if (err) taken.push('ERR:' + err.message); });
    setTimeout(() => resolve(taken), 300);
  });
}

(async () => {
  const xml = await fetchXml();
  console.log('Fetched persisted XML:', xml.length, 'chars');
  const r1 = await run(xml, { leaveType: 'Sick' }, 'sick');
  console.log('leaveType=Sick    =>', r1, r1.includes('Auto-Approved (Sick Leave)') ? 'PASS' : 'FAIL');
  const r2 = await run(xml, { leaveType: 'Annual' }, 'annual');
  console.log('leaveType=Annual  =>', r2, r2.includes('Approved') ? 'PASS' : 'FAIL');
  const r3 = await run(xml, { leaveType: 'Unpaid' }, 'unpaid');
  console.log('leaveType=Unpaid  =>', r3, r3.includes('Approved') ? 'PASS' : 'FAIL');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
