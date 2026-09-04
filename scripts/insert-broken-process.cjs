/** One-off: insert a process with a broken gateway condition DIRECTLY into the
 *  DB (bypasses the new API validation gate) to E2E-test the designer-side
 *  save gate. Idempotent: updates the row if it already exists. */
const { PrismaClient } = require('/home/z/my-project/mini-services/bpms-backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Defs_broken" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="P_broken" isExecutable="true">
    <bpmn:startEvent id="Start_1"><bpmn:outgoing>Flow_a</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="تکمیل درخواست"><bpmn:incoming>Flow_a</bpmn:incoming><bpmn:outgoing>Flow_g</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="Gw_1" name="بررسی"><bpmn:incoming>Flow_g</bpmn:incoming><bpmn:outgoing>Flow_bad</bpmn:outgoing><bpmn:outgoing>Flow_ok</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_2" name="مسیر خراب"><bpmn:incoming>Flow_bad</bpmn:incoming></bpmn:userTask>
    <bpmn:endEvent id="End_1"><bpmn:incoming>Flow_ok</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_a" sourceRef="Start_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_g" sourceRef="Task_1" targetRef="Gw_1" />
    <bpmn:sequenceFlow id="Flow_bad" name="مسیر شرطی" sourceRef="Gw_1" targetRef="Task_2"><bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.leaveType ==== 'Sick')</bpmn:conditionExpression></bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_ok" name="بدون شرط" sourceRef="Gw_1" targetRef="End_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="DI_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="P_broken">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="160" y="160" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="250" y="138" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gw_1_di" bpmnElement="Gw_1"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="410" y="145" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_2_di" bpmnElement="Task_2"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="520" y="138" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1"><dc:Bounds xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" x="700" y="160" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_a_di" bpmnElement="Flow_a"><di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="196" y="178" /><di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="250" y="178" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_g_di" bpmnElement="Flow_g"><di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="350" y="178" /><di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="410" y="170" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_bad_di" bpmnElement="Flow_bad"><di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="460" y="170" /><di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="520" y="178" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ok_di" bpmnElement="Flow_ok"><di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="460" y="170" /><di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="700" y="178" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

(async () => {
  const existing = await prisma.process.findFirst({ where: { name: '[پیش‌نویس] شرط خراب' } });
  if (existing) {
    await prisma.process.update({ where: { id: existing.id }, data: { bpmnXml: xml, status: 'DRAFT' } });
    console.log('updated existing broken process:', existing.id);
  } else {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const p = await prisma.process.create({ data: { name: '[پیش‌نویس] شرط خراب', bpmnXml: xml, status: 'DRAFT', createdById: admin.id } });
    console.log('created broken process:', p.id);
  }
  await prisma.$disconnect();
})();
