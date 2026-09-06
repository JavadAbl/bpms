/**
 * BPMS seed — Persian locale edition.
 *
 * Strategy (per request):
 *   - USERS ARE PRESERVED. Existing user rows (admin/john/jane/bob) are looked
 *     up by email and reused (ids + passwords untouched). Missing ones are
 *     created only when absent (fresh-DB safety).
 *   - EVERYTHING ELSE is wiped: departments, positions, user_positions,
 *     categories, forms, processes, variables, instances, tasks, assignments,
 *     submissions.
 *   - Then a COMPLETE WORKING Persian process is seeded end-to-end:
 *     org structure → category → forms → BPMN XML (with engine-compatible
 *     javascript conditions) → process variables → task assignments.
 *
 * Persian process (فرآیند درخواست مرخصی — leave request):
 *
 *   شروع → ثبت درخواست مرخصی → XOR«تصمیم نوع مرخصی»
 *      ├─ Sick   (استعلاجی)  → پایان: تایید خودکار
 *      ├─ Annual (استحقاقی) → تایید مدیر مستقیم ─┐
 *      └─ Unpaid (بدون حقوق) → تایید منابع انسانی ─┤
 *                                      XOR«ادامه مسیر»
 *                                            → اطلاع‌رسانی نتیجه → پایان: تکمیل شد
 *
 * Conditions use the ONLY format bpmn-engine accepts:
 *   language="javascript" with body  next(null, <expr>);
 */
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database (Persian locale edition)...');

  // -----------------------------------------------------------------------
  // 1) WIPE everything EXCEPT users (FK-safe order)
  // -----------------------------------------------------------------------
  await prisma.formSubmission.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.processStarter.deleteMany();
  await prisma.processInstance.deleteMany();
  await prisma.processVariable.deleteMany();
  await prisma.process.deleteMany();
  await prisma.form.deleteMany();
  await prisma.categoryItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.userPosition.deleteMany();
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();
  console.log('🧹 Cleared: submissions, tasks, assignments, starters, instances, variables, processes, forms, categories, positions, departments (users preserved)');

  // -----------------------------------------------------------------------
  // 2) Reuse existing users (do NOT touch their rows/passwords)
  // -----------------------------------------------------------------------
  const ensureUser = async (
    email: string,
    name: string,
    plainPassword: string,
    role: UserRole,
  ) => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return existing;
    return prisma.user.create({
      data: { email, name, password: await bcrypt.hash(plainPassword, 10), role },
    });
  };

  const admin = await ensureUser('admin@bpms.local', 'System Admin', 'admin123', UserRole.ADMIN);
  const john = await ensureUser('john@bpms.local', 'John Doe', 'user123', UserRole.USER);
  const jane = await ensureUser('jane@bpms.local', 'Jane Smith', 'user123', UserRole.USER);
  const bob = await ensureUser('bob@bpms.local', 'Bob Director', 'user123', UserRole.USER);
  console.log(`👤 Users preserved: ${admin.email}, ${john.email}, ${jane.email}, ${bob.email}`);

  // -----------------------------------------------------------------------
  // 3) Persian org structure (fresh)
  // -----------------------------------------------------------------------
  const engineering = await prisma.department.create({
    data: { name: 'مهندسی', description: 'واحد مهندسی و توسعه محصول' },
  });
  const hr = await prisma.department.create({
    data: { name: 'منابع انسانی', description: 'واحد منابع انسانی و اداری' },
  });
  const finance = await prisma.department.create({
    data: { name: 'مالی', description: 'واحد مالی و حسابداری' },
  });

  const staffPosition = await prisma.position.create({
    data: { departmentId: engineering.id, name: 'کارشناس فنی', description: 'کارشناس واحد مهندسی' },
  });
  const engManagerPosition = await prisma.position.create({
    data: { departmentId: engineering.id, name: 'مدیر مهندسی', description: 'مدیر واحد مهندسی', isManager: true },
  });
  const hrManagerPosition = await prisma.position.create({
    data: { departmentId: hr.id, name: 'مدیر منابع انسانی', description: 'مدیر واحد منابع انسانی', isManager: true },
  });
  const financeOfficerPosition = await prisma.position.create({
    data: { departmentId: finance.id, name: 'کارشناس مالی', description: 'کارشناس واحد مالی' },
  });

  // Link preserved users to the fresh positions
  await prisma.userPosition.create({ data: { userId: john.id, positionId: staffPosition.id } });
  await prisma.userPosition.create({ data: { userId: jane.id, positionId: engManagerPosition.id } });
  await prisma.userPosition.create({ data: { userId: jane.id, positionId: financeOfficerPosition.id } });
  await prisma.userPosition.create({ data: { userId: bob.id, positionId: hrManagerPosition.id } });
  console.log('🏢 Departments: مهندسی، منابع انسانی، مالی — positions & user links created');

  // -----------------------------------------------------------------------
  // 4) Global category — reusable dropdown list (stable values, Persian labels)
  // -----------------------------------------------------------------------
  const leaveTypes = await prisma.category.create({
    data: {
      key: 'leave_types',
      name: 'انواع مرخصی',
      description: 'فهرست قابل استفاده مجدد انواع مرخصی برای فرم‌ها',
      items: {
        create: [
          { value: 'Annual', label: 'مرخصی استحقاقی', sortOrder: 0 },
          { value: 'Sick', label: 'مرخصی استعلاجی', sortOrder: 1 },
          { value: 'Unpaid', label: 'مرخصی بدون حقوق', sortOrder: 2 },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`🗂️ Category «انواع مرخصی» created with ${leaveTypes.items.length} items (values: Annual/Sick/Unpaid)`);

  // -----------------------------------------------------------------------
  // 5) BPMN XML — Persian leave request with conditional exclusive gateway
  //    Conditions use the engine-mandated format:
  //    language="javascript" + next(null, expr);
  // -----------------------------------------------------------------------
  const bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_LeaveFa" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="LeaveRequestProcessFa" name="فرآیند درخواست مرخصی" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="شروع">
      <bpmn:outgoing>Flow_Start</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="Flow_Start" sourceRef="StartEvent_1" targetRef="SubmitLeaveRequest" />
    <bpmn:userTask id="SubmitLeaveRequest" name="ثبت درخواست مرخصی">
      <bpmn:incoming>Flow_Start</bpmn:incoming>
      <bpmn:outgoing>Flow_ToGateway</bpmn:outgoing>
      <bpmn:documentation>کارمند درخواست مرخصی خود را ثبت می‌کند</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_ToGateway" sourceRef="SubmitLeaveRequest" targetRef="LeaveTypeGateway" />
    <bpmn:exclusiveGateway id="LeaveTypeGateway" name="تصمیم نوع مرخصی">
      <bpmn:incoming>Flow_ToGateway</bpmn:incoming>
      <bpmn:outgoing>Flow_Sick</bpmn:outgoing>
      <bpmn:outgoing>Flow_Annual</bpmn:outgoing>
      <bpmn:outgoing>Flow_Unpaid</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="Flow_Sick" name="استعلاجی" sourceRef="LeaveTypeGateway" targetRef="EndAutoApproved">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.leaveType === 'Sick');</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Annual" name="استحقاقی" sourceRef="LeaveTypeGateway" targetRef="ManagerApproval">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.leaveType === 'Annual');</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_Unpaid" name="بدون حقوق" sourceRef="LeaveTypeGateway" targetRef="HRApproval">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.leaveType === 'Unpaid');</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:endEvent id="EndAutoApproved" name="پایان: تایید خودکار (استعلاجی)">
      <bpmn:incoming>Flow_Sick</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:userTask id="ManagerApproval" name="تایید مدیر مستقیم">
      <bpmn:incoming>Flow_Annual</bpmn:incoming>
      <bpmn:outgoing>Flow_MgrToJoin</bpmn:outgoing>
      <bpmn:documentation>مدیر مستقیم درخواست مرخصی استحقاقی را بررسی و تایید یا رد می‌کند</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_MgrToJoin" sourceRef="ManagerApproval" targetRef="MergeGateway" />
    <bpmn:userTask id="HRApproval" name="تایید منابع انسانی">
      <bpmn:incoming>Flow_Unpaid</bpmn:incoming>
      <bpmn:outgoing>Flow_HRToJoin</bpmn:outgoing>
      <bpmn:documentation>منابع انسانی درخواست مرخصی بدون حقوق را بررسی و تایید یا رد می‌کند</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_HRToJoin" sourceRef="HRApproval" targetRef="MergeGateway" />
    <bpmn:exclusiveGateway id="MergeGateway" name="ادامه مسیر">
      <bpmn:incoming>Flow_MgrToJoin</bpmn:incoming>
      <bpmn:incoming>Flow_HRToJoin</bpmn:incoming>
      <bpmn:outgoing>Flow_JoinToNotify</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="Flow_JoinToNotify" sourceRef="MergeGateway" targetRef="NotifyResult" />
    <bpmn:userTask id="NotifyResult" name="اطلاع‌رسانی نتیجه">
      <bpmn:incoming>Flow_JoinToNotify</bpmn:incoming>
      <bpmn:outgoing>Flow_NotifyToEnd</bpmn:outgoing>
      <bpmn:documentation>نتیجه درخواست به کارمند اطلاع داده می‌شود</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_NotifyToEnd" sourceRef="NotifyResult" targetRef="EndCompleted" />
    <bpmn:endEvent id="EndCompleted" name="پایان: تکمیل شد">
      <bpmn:incoming>Flow_NotifyToEnd</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_LeaveFa">
    <bpmndi:BPMNPlane id="BPMNPlane_LeaveFa" bpmnElement="LeaveRequestProcessFa">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="172" y="202" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubmitLeaveRequest_di" bpmnElement="SubmitLeaveRequest">
        <dc:Bounds x="250" y="180" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="LeaveTypeGateway_di" bpmnElement="LeaveTypeGateway" isMarkerVisible="true">
        <dc:Bounds x="392" y="195" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndAutoApproved_di" bpmnElement="EndAutoApproved">
        <dc:Bounds x="560" y="62" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ManagerApproval_di" bpmnElement="ManagerApproval">
        <dc:Bounds x="502" y="180" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="HRApproval_di" bpmnElement="HRApproval">
        <dc:Bounds x="502" y="320" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="MergeGateway_di" bpmnElement="MergeGateway" isMarkerVisible="true">
        <dc:Bounds x="640" y="195" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="NotifyResult_di" bpmnElement="NotifyResult">
        <dc:Bounds x="730" y="180" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndCompleted_di" bpmnElement="EndCompleted">
        <dc:Bounds x="870" y="202" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_Start_di" bpmnElement="Flow_Start">
        <di:waypoint x="208" y="220" />
        <di:waypoint x="250" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ToGateway_di" bpmnElement="Flow_ToGateway">
        <di:waypoint x="350" y="220" />
        <di:waypoint x="392" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Sick_di" bpmnElement="Flow_Sick">
        <di:waypoint x="417" y="195" />
        <di:waypoint x="417" y="80" />
        <di:waypoint x="560" y="80" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Annual_di" bpmnElement="Flow_Annual">
        <di:waypoint x="442" y="220" />
        <di:waypoint x="502" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_Unpaid_di" bpmnElement="Flow_Unpaid">
        <di:waypoint x="417" y="245" />
        <di:waypoint x="417" y="360" />
        <di:waypoint x="502" y="360" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_MgrToJoin_di" bpmnElement="Flow_MgrToJoin">
        <di:waypoint x="602" y="220" />
        <di:waypoint x="640" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_HRToJoin_di" bpmnElement="Flow_HRToJoin">
        <di:waypoint x="602" y="360" />
        <di:waypoint x="665" y="360" />
        <di:waypoint x="665" y="245" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_JoinToNotify_di" bpmnElement="Flow_JoinToNotify">
        <di:waypoint x="690" y="220" />
        <di:waypoint x="730" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_NotifyToEnd_di" bpmnElement="Flow_NotifyToEnd">
        <di:waypoint x="830" y="220" />
        <di:waypoint x="870" y="220" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  // -----------------------------------------------------------------------
  // 6) Create the process + forms + variables + assignments
  // -----------------------------------------------------------------------
  const process = await prisma.process.create({
    data: {
      name: 'فرآیند درخواست مرخصی',
      description: 'نمونه کامل فرآیند مرخصی با تصمیم‌گیری خودکار بر اساس نوع مرخصی (استحقاقی/استعلاجی/بدون حقوق)',
      bpmnXml,
      version: 1,
      status: 'ACTIVE',
      createdById: admin.id,
      // Immutable version history (v1) — created alongside the process
      versions: { create: { version: 1, bpmnXml, createdById: admin.id, note: 'نسخه اولیه' } },
    },
  });

  const leaveRequestForm = await prisma.form.create({
    data: {
      name: 'فرم درخواست مرخصی',
      description: 'فرمی که کارمند برای ثبت درخواست مرخصی تکمیل می‌کند',
      processId: process.id,
      fields: JSON.stringify([
        { name: 'employeeName', label: 'نام و نام خانوادگی', type: 'text', required: true },
        // Reusable category «انواع مرخصی»: stable values (Annual/Sick/Unpaid) with Persian labels
        { name: 'leaveType', label: 'نوع مرخصی', type: 'select', required: true, categoryId: leaveTypes.id, options: ['Annual', 'Sick', 'Unpaid'] },
        { name: 'startDate', label: 'تاریخ شروع', type: 'date', required: true },
        { name: 'endDate', label: 'تاریخ پایان', type: 'date', required: true },
        { name: 'reason', label: 'توضیحات', type: 'textarea', required: false },
        // Optional document attachments — metas stored in the submission, bytes on server disk;
        // approvers get a download-only readOnly mirror below
        { name: 'attachments', label: 'پیوست مدارک (گواهی پزشک و ...)', type: 'file', required: false, multiple: true },
      ]),
    },
  });

  const leaveApprovalForm = await prisma.form.create({
    data: {
      name: 'فرم تایید درخواست',
      description: 'فرمی که مدیر/منابع انسانی برای بررسی و تصمیم‌گیری تکمیل می‌کند',
      processId: process.id,
      fields: JSON.stringify([
        // Read-only mirrors of what the employee submitted in the previous task
        { name: 'employeeName', label: 'نام کارمند', type: 'text', required: false, readOnly: true },
        { name: 'leaveType', label: 'نوع مرخصی', type: 'select', required: false, readOnly: true, categoryId: leaveTypes.id, options: ['Annual', 'Sick', 'Unpaid'] },
        { name: 'startDate', label: 'تاریخ شروع', type: 'date', required: false, readOnly: true },
        { name: 'endDate', label: 'تاریخ پایان', type: 'date', required: false, readOnly: true },
        { name: 'reason', label: 'توضیحات', type: 'textarea', required: false, readOnly: true },
        // Download-only view of the documents the employee attached
        { name: 'attachments', label: 'پیوست‌های درخواست', type: 'file', required: false, readOnly: true, multiple: true },
        // Editable decision fields (inline Persian options)
        { name: 'decision', label: 'تصمیم', type: 'select', required: true, options: ['تایید', 'رد'] },
        { name: 'comment', label: 'نظر مدیر', type: 'textarea', required: false },
      ]),
    },
  });

  const notifyForm = await prisma.form.create({
    data: {
      name: 'فرم اطلاع‌رسانی نتیجه',
      description: 'فرمی برای ثبت اطلاع‌رسانی نتیجه به کارمند',
      processId: process.id,
      fields: JSON.stringify([
        { name: 'notifyMethod', label: 'روش اطلاع‌رسانی', type: 'select', required: true, options: ['ایمیل', 'پیامک', 'حضوری'] },
        { name: 'notifyNote', label: 'یادداشت', type: 'textarea', required: false },
      ]),
    },
  });

  await prisma.processVariable.createMany({
    data: [
      { processId: process.id, name: 'employeeName', label: 'نام و نام خانوادگی', type: 'text' },
      { processId: process.id, name: 'leaveType', label: 'نوع مرخصی', type: 'select' },
      { processId: process.id, name: 'startDate', label: 'تاریخ شروع', type: 'date' },
      { processId: process.id, name: 'endDate', label: 'تاریخ پایان', type: 'date' },
      { processId: process.id, name: 'reason', label: 'توضیحات', type: 'text' },
      { processId: process.id, name: 'decision', label: 'تصمیم', type: 'select' },
      { processId: process.id, name: 'comment', label: 'نظر مدیر', type: 'text' },
    ],
  });

  await prisma.taskAssignment.createMany({
    data: [
      // taskName MUST exactly match the BPMN userTask name attributes.
      // Declarative strategies — no triggers, no code. Starter-based ones are
      // TASK-scoped: sourceTaskName picks WHICH task's performer the routing
      // follows (not the whole process starter), so each step can follow a
      // different performer's chain.
      //   FIXED_USER           → the picked user
      //   TASK_STARTER_MANAGER → manager (isManager position) of the performer
      //                          of sourceTaskName
      //   TASK_STARTER         → the performer of sourceTaskName themself
      //   POSITION             → pool of all holders of the given position
      { processId: process.id, taskName: 'ثبت درخواست مرخصی', strategy: 'FIXED_USER', assigneeId: john.id, formId: leaveRequestForm.id },
      { processId: process.id, taskName: 'تایید مدیر مستقیم', strategy: 'TASK_STARTER_MANAGER', sourceTaskName: 'ثبت درخواست مرخصی', formId: leaveApprovalForm.id },
      { processId: process.id, taskName: 'تایید منابع انسانی', strategy: 'POSITION', positionId: hrManagerPosition.id, formId: leaveApprovalForm.id },
      { processId: process.id, taskName: 'اطلاع‌رسانی نتیجه', strategy: 'TASK_STARTER', sourceTaskName: 'ثبت درخواست مرخصی', formId: notifyForm.id },
    ],
  });

  console.log(`📋 Process «فرآیند درخواست مرخصی» created (id=${process.id})`);
  console.log('📝 Forms: فرم درخواست مرخصی، فرم تایید درخواست، فرم اطلاع‌رسانی نتیجه');
  console.log('🔗 4 task assignments bound via declarative strategies (FIXED_USER / TASK_STARTER_MANAGER / TASK_STARTER / POSITION)');
  console.log('✅ Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
