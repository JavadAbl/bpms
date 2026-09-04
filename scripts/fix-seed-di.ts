/**
 * One-off data fix: append <bpmndi:BPMNDiagram> sections to the seeded
 * processes whose BPMN XML lacked diagram interchange (DI) data.
 * Without DI, bpmn-js cannot render the diagram ("no diagram to display").
 *
 * Run: DATABASE_URL=file:.../bpms.db bun /home/z/my-project/scripts/fix-seed-di.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DI_NS = 'xmlns:di="http://www.omg.org/spec/DD/20100524/DI"';

const LEAVE_DI = `  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="LeaveApprovalProcess">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="172" y="122" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubmitRequest_di" bpmnElement="SubmitRequest">
        <dc:Bounds x="250" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="DecisionGateway_di" bpmnElement="DecisionGateway" isMarkerVisible="true">
        <dc:Bounds x="392" y="115" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="AutoApproveEnd_di" bpmnElement="AutoApproveEnd">
        <dc:Bounds x="602" y="122" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ApproveRequest_di" bpmnElement="ApproveRequest">
        <dc:Bounds x="502" y="210" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ApprovedEnd_di" bpmnElement="ApprovedEnd">
        <dc:Bounds x="654" y="232" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="208" y="140" />
        <di:waypoint x="250" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="140" />
        <di:waypoint x="392" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Sick_di" bpmnElement="Flow_Sick">
        <di:waypoint x="442" y="140" />
        <di:waypoint x="602" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_NeedsApproval_di" bpmnElement="Flow_NeedsApproval">
        <di:waypoint x="417" y="165" />
        <di:waypoint x="417" y="250" />
        <di:waypoint x="502" y="250" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="602" y="250" />
        <di:waypoint x="654" y="250" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>`;

const EXPENSE_DI = `  <bpmndi:BPMNDiagram id="BPMNDiagram_Expense">
    <bpmndi:BPMNPlane id="BPMNPlane_Expense" bpmnElement="ExpenseApprovalProcess">
      <bpmndi:BPMNShape id="Exp_StartEvent_di" bpmnElement="Exp_StartEvent">
        <dc:Bounds x="172" y="282" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubmitExpense_di" bpmnElement="SubmitExpense">
        <dc:Bounds x="250" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="InclusiveGateway_di" bpmnElement="InclusiveGateway">
        <dc:Bounds x="392" y="275" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ManagerApprove_di" bpmnElement="ManagerApprove">
        <dc:Bounds x="502" y="100" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="DirectorApprove_di" bpmnElement="DirectorApprove">
        <dc:Bounds x="502" y="260" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ComplianceReview_di" bpmnElement="ComplianceReview">
        <dc:Bounds x="502" y="420" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ApprovalJoin_di" bpmnElement="ApprovalJoin" isMarkerVisible="true">
        <dc:Bounds x="672" y="275" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ParallelSplit_di" bpmnElement="ParallelSplit" isMarkerVisible="true">
        <dc:Bounds x="764" y="275" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ProcessPayment_di" bpmnElement="ProcessPayment">
        <dc:Bounds x="864" y="210" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ArchiveRecord_di" bpmnElement="ArchiveRecord">
        <dc:Bounds x="864" y="360" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ParallelJoin_di" bpmnElement="ParallelJoin" isMarkerVisible="true">
        <dc:Bounds x="1034" y="275" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Exp_EndEvent_di" bpmnElement="Exp_EndEvent">
        <dc:Bounds x="1126" y="282" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Exp_Flow_1_di" bpmnElement="Exp_Flow_1">
        <di:waypoint x="208" y="300" />
        <di:waypoint x="250" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_2_di" bpmnElement="Exp_Flow_2">
        <di:waypoint x="350" y="300" />
        <di:waypoint x="392" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_Manager_di" bpmnElement="Exp_Flow_Manager">
        <di:waypoint x="442" y="300" />
        <di:waypoint x="470" y="300" />
        <di:waypoint x="470" y="140" />
        <di:waypoint x="502" y="140" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_Director_di" bpmnElement="Exp_Flow_Director">
        <di:waypoint x="442" y="300" />
        <di:waypoint x="502" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_Compliance_di" bpmnElement="Exp_Flow_Compliance">
        <di:waypoint x="442" y="300" />
        <di:waypoint x="470" y="300" />
        <di:waypoint x="470" y="460" />
        <di:waypoint x="502" y="460" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_MgrJoin_di" bpmnElement="Exp_Flow_MgrJoin">
        <di:waypoint x="602" y="140" />
        <di:waypoint x="697" y="140" />
        <di:waypoint x="697" y="275" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_DirJoin_di" bpmnElement="Exp_Flow_DirJoin">
        <di:waypoint x="602" y="300" />
        <di:waypoint x="672" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_CompJoin_di" bpmnElement="Exp_Flow_CompJoin">
        <di:waypoint x="602" y="460" />
        <di:waypoint x="697" y="460" />
        <di:waypoint x="697" y="325" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_ToParallel_di" bpmnElement="Exp_Flow_ToParallel">
        <di:waypoint x="722" y="300" />
        <di:waypoint x="764" y="300" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_Payment_di" bpmnElement="Exp_Flow_Payment">
        <di:waypoint x="814" y="300" />
        <di:waypoint x="839" y="300" />
        <di:waypoint x="839" y="250" />
        <di:waypoint x="864" y="250" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_Archive_di" bpmnElement="Exp_Flow_Archive">
        <di:waypoint x="814" y="300" />
        <di:waypoint x="839" y="300" />
        <di:waypoint x="839" y="400" />
        <di:waypoint x="864" y="400" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_PayJoin_di" bpmnElement="Exp_Flow_PayJoin">
        <di:waypoint x="964" y="250" />
        <di:waypoint x="1059" y="250" />
        <di:waypoint x="1059" y="275" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_ArcJoin_di" bpmnElement="Exp_Flow_ArcJoin">
        <di:waypoint x="964" y="400" />
        <di:waypoint x="1059" y="400" />
        <di:waypoint x="1059" y="325" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Exp_Flow_End_di" bpmnElement="Exp_Flow_End">
        <di:waypoint x="1084" y="300" />
        <di:waypoint x="1126" y="300" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>`;

function addDi(xml: string, planeBpmnElement: string, diBlock: string): string {
  if (xml.includes('<bpmndi:BPMNDiagram')) {
    console.log('  already has DI — skipping');
    return xml;
  }
  let out = xml;
  // 1. Ensure the `di` namespace is declared on <bpmn:definitions>
  if (!out.includes('xmlns:di=')) {
    out = out.replace(
      'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"',
      `xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" ${DI_NS}`,
    );
  }
  // 2. Insert the DI block between </bpmn:process> and </bpmn:definitions>
  const marker = '</bpmn:process>';
  const idx = out.lastIndexOf(marker);
  if (idx === -1) throw new Error(`No </bpmn:process> found (plane ${planeBpmnElement})`);
  out = out.slice(0, idx + marker.length) + '\n' + diBlock + '\n' + out.slice(idx + marker.length);
  return out;
}

async function main() {
  const targets = [
    { name: 'Leave Approval', di: LEAVE_DI },
    { name: 'Expense Approval', di: EXPENSE_DI },
  ];

  for (const t of targets) {
    const proc = await prisma.process.findFirst({ where: { name: t.name } });
    if (!proc) {
      console.log(`Process "${t.name}" not found — skipping`);
      continue;
    }
    console.log(`Patching process "${t.name}" (id=${proc.id})...`);
    const fixed = addDi(proc.bpmnXml, proc.name, t.di);
    await prisma.process.update({ where: { id: proc.id }, data: { bpmnXml: fixed } });
    console.log(`  updated (xml length ${proc.bpmnXml.length} -> ${fixed.length})`);
  }
  console.log('DI patch complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
