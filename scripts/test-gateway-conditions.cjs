// Validates gateway condition expressions exactly as the designer UI + backend signalTask will produce them.
// Flow: Start -> UserTask(form) -> ExclusiveGateway(conditioned flows) -> End events
const { Engine } = require('/home/z/my-project/mini-services/bpms-backend/node_modules/bpmn-engine');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Defs_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="P_1" isExecutable="true">
    <bpmn:startEvent id="Start_1"><bpmn:outgoing>Flow_s</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="fill"><bpmn:incoming>Flow_s</bpmn:incoming><bpmn:outgoing>Flow_g</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="GW_1" name="amount gateway"><bpmn:incoming>Flow_g</bpmn:incoming><bpmn:outgoing>Flow_high</bpmn:outgoing><bpmn:outgoing>Flow_low</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:endEvent id="End_high" name="high"><bpmn:incoming>Flow_high</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="End_low" name="low"><bpmn:incoming>Flow_low</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_s" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_g" sourceRef="Task_1" targetRef="GW_1" />
    <bpmn:sequenceFlow id="Flow_high" sourceRef="GW_1" targetRef="End_high">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression"><![CDATA[environment.variables.amount > 1000]]></bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_low" sourceRef="GW_1" targetRef="End_low">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression"><![CDATA[environment.variables.type == 'annual']]></bpmn:conditionExpression>
    </bpmn:sequenceFlow>
  </bpmn:process>
</bpmn:definitions>`;

async function run(variables, label) {
  return new Promise((resolve, reject) => {
    const taken = [];
    const engine = Engine({ name: `t3-${label}`, source: xml });
    const listener = new (require('events').EventEmitter)();
    listener.on('activity.end', (api) => {
      if (api.type === 'bpmn:EndEvent') taken.push(api.content.name || api.id);
    });
    listener.on('wait', (api) => {
      // EXACTLY what BpmnEngineService.signalTask does:
      if (api.environment && variables) Object.assign(api.environment.variables, variables);
      api.signal(variables);
    });
    listener.on('error', (err) => reject(err));
    engine.execute({ listener }, (err) => { if (err) reject(err); });
    setTimeout(() => resolve(taken), 200);
  });
}

(async () => {
  const r1 = await run({ amount: 1500, type: 'whatever' }, 'high');
  console.log('amount=1500,type=whatever =>', r1, r1[0] === 'high' ? 'PASS' : 'FAIL');
  const r2 = await run({ amount: 500, type: 'annual' }, 'low');
  console.log('amount=500,type=annual   =>', r2, r2[0] === 'low' ? 'PASS' : 'FAIL');
  const r3 = await run({ amount: 500, type: 'sick' }, 'none');
  console.log('amount=500,type=sick     =>', r3, '(no match — engine default behavior)');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
