import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Wipe data in dependency order
  await prisma.formSubmission.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.processInstance.deleteMany();
  await prisma.process.deleteMany();
  await prisma.form.deleteMany();
  await prisma.userPosition.deleteMany();
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  // --- Admin user -------------------------------------------------------
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@bpms.local',
      name: 'System Admin',
      password: adminPassword,
      role: UserRole.ADMIN,
    },
  });
  console.log(`Created admin: ${admin.email} / admin123`);

  // --- Regular user -----------------------------------------------------
  const userPassword = await bcrypt.hash('user123', 10);
  const john = await prisma.user.create({
    data: {
      email: 'john@bpms.local',
      name: 'John Doe',
      password: userPassword,
      role: UserRole.USER,
    },
  });
  console.log(`Created user:  ${john.email} / user123`);

  const jane = await prisma.user.create({
    data: {
      email: 'jane@bpms.local',
      name: 'Jane Smith',
      password: userPassword,
      role: UserRole.USER,
    },
  });
  console.log(`Created user:  ${jane.email} / user123`);

  const bob = await prisma.user.create({
    data: {
      email: 'bob@bpms.local',
      name: 'Bob Director',
      password: userPassword,
      role: UserRole.USER,
    },
  });
  console.log(`Created user:  ${bob.email} / user123`);

  // --- Departments & Positions -------------------------------------------
  const engineering = await prisma.department.create({
    data: { name: 'Engineering', description: 'Software engineering department' },
  });
  const finance = await prisma.department.create({
    data: { name: 'Finance', description: 'Finance & accounting department' },
  });
  const hr = await prisma.department.create({
    data: { name: 'Human Resources', description: 'HR department' },
  });

  // Positions in Engineering
  const engEmployee = await prisma.position.create({
    data: { departmentId: engineering.id, name: 'Engineer', description: 'Software engineer' },
  });
  const engManager = await prisma.position.create({
    data: { departmentId: engineering.id, name: 'Engineering Manager', description: 'Manages engineers' },
  });
  const engDirector = await prisma.position.create({
    data: { departmentId: engineering.id, name: 'Engineering Director', description: 'Director of engineering' },
  });

  // Positions in Finance
  const finOfficer = await prisma.position.create({
    data: { departmentId: finance.id, name: 'Finance Officer', description: 'Processes payments' },
  });
  const finManager = await prisma.position.create({
    data: { departmentId: finance.id, name: 'Finance Manager', description: 'Manages finance team' },
  });

  // Positions in HR
  const hrManager = await prisma.position.create({
    data: { departmentId: hr.id, name: 'HR Manager', description: 'Manages HR operations' },
  });
  const complianceOfficer = await prisma.position.create({
    data: { departmentId: hr.id, name: 'Compliance Officer', description: 'Reviews compliance' },
  });

  // Assign users to positions
  // John: Engineer (can submit requests)
  await prisma.userPosition.create({ data: { userId: john.id, positionId: engEmployee.id } });
  // Jane: Engineering Manager + Finance Officer (can approve + process payments)
  await prisma.userPosition.create({ data: { userId: jane.id, positionId: engManager.id } });
  await prisma.userPosition.create({ data: { userId: jane.id, positionId: finOfficer.id } });
  // Bob: Engineering Director (can approve large expenses)
  await prisma.userPosition.create({ data: { userId: bob.id, positionId: engDirector.id } });
  // Admin: Compliance Officer (can review compliance)
  await prisma.userPosition.create({ data: { userId: admin.id, positionId: complianceOfficer.id } });

  console.log(`Created departments: ${engineering.name}, ${finance.name}, ${hr.name}`);
  console.log(`Created positions: Engineer, Engineering Manager, Engineering Director, Finance Officer, Finance Manager, HR Manager, Compliance Officer`);
  console.log(`Assigned users to positions`);

  // --- Sample forms -----------------------------------------------------
  const requestForm = await prisma.form.create({
    data: {
      name: 'Leave Request Form',
      description: 'Form used by employees to submit a leave request',
      fields: JSON.stringify([
        { name: 'employeeName', label: 'Employee Name', type: 'text', required: true },
        { name: 'leaveType', label: 'Leave Type', type: 'select', required: true, options: ['Annual', 'Sick', 'Unpaid'] },
        { name: 'startDate', label: 'Start Date', type: 'date', required: true },
        { name: 'endDate', label: 'End Date', type: 'date', required: true },
        { name: 'reason', label: 'Reason', type: 'textarea', required: false },
      ]),
    },
  });

  const approvalForm = await prisma.form.create({
    data: {
      name: 'Approval Form',
      description: 'Form used by manager to approve or reject a request',
      fields: JSON.stringify([
        { name: 'decision', label: 'Decision', type: 'select', required: true, options: ['Approve', 'Reject'] },
        { name: 'comment', label: 'Comment', type: 'textarea', required: false },
      ]),
    },
  });

  console.log(`Created forms: ${requestForm.name}, ${approvalForm.name}`);

  const expenseForm = await prisma.form.create({
    data: {
      name: 'Expense Claim Form',
      description: 'Form used by employees to submit an expense claim',
      fields: JSON.stringify([
        { name: 'description', label: 'Description', type: 'text', required: true },
        { name: 'amount', label: 'Amount ($)', type: 'number', required: true },
        { name: 'category', label: 'Category', type: 'select', required: true, options: ['Travel', 'Meals', 'Equipment', 'Training', 'Other'] },
        { name: 'receipt', label: 'Receipt Number', type: 'text', required: false },
      ]),
    },
  });

  const paymentForm = await prisma.form.create({
    data: {
      name: 'Payment Processing Form',
      description: 'Form used by finance to record payment details',
      fields: JSON.stringify([
        { name: 'paymentMethod', label: 'Payment Method', type: 'select', required: true, options: ['Bank Transfer', 'Cheque', 'Cash'] },
        { name: 'reference', label: 'Reference Number', type: 'text', required: true },
        { name: 'paidDate', label: 'Payment Date', type: 'date', required: true },
      ]),
    },
  });

  const archiveForm = await prisma.form.create({
    data: {
      name: 'Archive Record Form',
      description: 'Form used to archive a completed expense record',
      fields: JSON.stringify([
        { name: 'archiveId', label: 'Archive ID', type: 'text', required: true },
        { name: 'notes', label: 'Archive Notes', type: 'textarea', required: false },
      ]),
    },
  });

  console.log(`Created forms: ${expenseForm.name}, ${paymentForm.name}, ${archiveForm.name}`);

  // --- Sample BPMN process (leave approval workflow with exclusive gateway)
  // Flow:
  //   Start → Submit Request → Decision Gateway ─┬─ Sick leave ──→ Auto-Approve End
  //                                               └─ Annual/Unpaid → Approve Request → Approved End
  // The gateway condition reads `variables.leaveType` which is set by the
  // Submit Request form submission (signaled to the engine as task output).
  const bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="LeaveApprovalProcess" name="Leave Approval" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="Start">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="SubmitRequest" />
    <bpmn:userTask id="SubmitRequest" name="Submit Request">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
      <bpmn:documentation>Employee submits a leave request</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="SubmitRequest" targetRef="DecisionGateway" />
    <bpmn:exclusiveGateway id="DecisionGateway" name="Leave Type Decision">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_Sick</bpmn:outgoing>
      <bpmn:outgoing>Flow_NeedsApproval</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="Flow_Sick" sourceRef="DecisionGateway" targetRef="AutoApproveEnd">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.leaveType === 'Sick');</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_NeedsApproval" sourceRef="DecisionGateway" targetRef="ApproveRequest">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.leaveType !== 'Sick');</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:userTask id="ApproveRequest" name="Approve Request">
      <bpmn:incoming>Flow_NeedsApproval</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
      <bpmn:documentation>Manager reviews and approves/rejects the request</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="ApproveRequest" targetRef="ApprovedEnd" />
    <bpmn:endEvent id="ApprovedEnd" name="Approved">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="AutoApproveEnd" name="Auto-Approved (Sick Leave)">
      <bpmn:incoming>Flow_Sick</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>`;

  const process = await prisma.process.create({
    data: {
      name: 'Leave Approval',
      description: 'Standard employee leave approval workflow',
      bpmnXml,
      version: 1,
      status: 'ACTIVE',
      createdById: admin.id,
    },
  });

  // Bind tasks to users and forms
  // Associate forms with this process (process-scoped forms)
  await prisma.form.update({ where: { id: requestForm.id }, data: { processId: process.id } });
  await prisma.form.update({ where: { id: approvalForm.id }, data: { processId: process.id } });

  await prisma.taskAssignment.create({
    data: {
      processId: process.id,
      taskName: 'Submit Request',
      assigneeId: john.id,
      formId: requestForm.id,
    },
  });

  await prisma.taskAssignment.create({
    data: {
      processId: process.id,
      taskName: 'Approve Request',
      assigneeId: jane.id,
      formId: approvalForm.id,
    },
  });

  console.log(`Created process: ${process.name} (id=${process.id})`);

  // --- Expense Approval process with exclusive, parallel, AND inclusive gateways
  // Flow:
  //   Start → Submit Expense → InclusiveGateway ─┬─ amount > 1000 → Director Approve ──┐
  //                                               ├─ amount > 5000 → Compliance Review ─┤
  //                                               └─ !(amount > 1000) → Manager Approve┤
  //                                                                                       ↓
  //                                                                                 ParallelJoin (inclusive merge)
  //                                                                                       ↓
  //                                                                                 ParallelSplit ─┬─ Process Payment ─┐
  //                                                                                                └─ Archive Record  ─┘
  //                                                                                                         ↓
  //                                                                                                 ParallelJoin
  //                                                                                                         ↓
  //                                                                                                       End
  //
  // Routing examples:
  //   amount=500  → Manager Approve only
  //   amount=2000 → Director Approve only
  //   amount=6000 → Director Approve + Compliance Review (both run, join waits for both)
  //
  // This demonstrates:
  //  - Inclusive gateway (takes ALL flows whose conditions are true)
  //  - Parallel gateway split (creates two simultaneous finalization tasks)
  //  - Parallel gateway join (waits for all taken flows to complete)
  const expenseBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_Expense" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="ExpenseApprovalProcess" name="Expense Approval" isExecutable="true">
    <bpmn:startEvent id="Exp_StartEvent" name="Start">
      <bpmn:outgoing>Exp_Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="Exp_Flow_1" sourceRef="Exp_StartEvent" targetRef="SubmitExpense" />
    <bpmn:userTask id="SubmitExpense" name="Submit Expense">
      <bpmn:incoming>Exp_Flow_1</bpmn:incoming>
      <bpmn:outgoing>Exp_Flow_2</bpmn:outgoing>
      <bpmn:documentation>Employee submits an expense claim with amount</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Exp_Flow_2" sourceRef="SubmitExpense" targetRef="InclusiveGateway" />
    <bpmn:inclusiveGateway id="InclusiveGateway" name="Amount Routing">
      <bpmn:incoming>Exp_Flow_2</bpmn:incoming>
      <bpmn:outgoing>Exp_Flow_Director</bpmn:outgoing>
      <bpmn:outgoing>Exp_Flow_Compliance</bpmn:outgoing>
      <bpmn:outgoing>Exp_Flow_Manager</bpmn:outgoing>
    </bpmn:inclusiveGateway>
    <bpmn:sequenceFlow id="Exp_Flow_Director" sourceRef="InclusiveGateway" targetRef="DirectorApprove">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.amount > 1000);</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Exp_Flow_Compliance" sourceRef="InclusiveGateway" targetRef="ComplianceReview">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.amount > 5000);</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Exp_Flow_Manager" sourceRef="InclusiveGateway" targetRef="ManagerApprove">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, !(environment.variables.amount > 1000));</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:userTask id="DirectorApprove" name="Director Approve">
      <bpmn:incoming>Exp_Flow_Director</bpmn:incoming>
      <bpmn:outgoing>Exp_Flow_DirJoin</bpmn:outgoing>
      <bpmn:documentation>Director approves expenses over $1000</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:userTask id="ComplianceReview" name="Compliance Review">
      <bpmn:incoming>Exp_Flow_Compliance</bpmn:incoming>
      <bpmn:outgoing>Exp_Flow_CompJoin</bpmn:outgoing>
      <bpmn:documentation>Compliance review for expenses over $5000</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:userTask id="ManagerApprove" name="Manager Approve">
      <bpmn:incoming>Exp_Flow_Manager</bpmn:incoming>
      <bpmn:outgoing>Exp_Flow_MgrJoin</bpmn:outgoing>
      <bpmn:documentation>Manager approves expenses up to $1000</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:parallelGateway id="ApprovalJoin" name="Join After Approval">
      <bpmn:incoming>Exp_Flow_DirJoin</bpmn:incoming>
      <bpmn:incoming>Exp_Flow_CompJoin</bpmn:incoming>
      <bpmn:incoming>Exp_Flow_MgrJoin</bpmn:incoming>
      <bpmn:outgoing>Exp_Flow_ToParallel</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:sequenceFlow id="Exp_Flow_DirJoin" sourceRef="DirectorApprove" targetRef="ApprovalJoin" />
    <bpmn:sequenceFlow id="Exp_Flow_CompJoin" sourceRef="ComplianceReview" targetRef="ApprovalJoin" />
    <bpmn:sequenceFlow id="Exp_Flow_MgrJoin" sourceRef="ManagerApprove" targetRef="ApprovalJoin" />
    <bpmn:sequenceFlow id="Exp_Flow_ToParallel" sourceRef="ApprovalJoin" targetRef="ParallelSplit" />
    <bpmn:parallelGateway id="ParallelSplit" name="Parallel Split">
      <bpmn:incoming>Exp_Flow_ToParallel</bpmn:incoming>
      <bpmn:outgoing>Exp_Flow_Payment</bpmn:outgoing>
      <bpmn:outgoing>Exp_Flow_Archive</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:sequenceFlow id="Exp_Flow_Payment" sourceRef="ParallelSplit" targetRef="ProcessPayment" />
    <bpmn:sequenceFlow id="Exp_Flow_Archive" sourceRef="ParallelSplit" targetRef="ArchiveRecord" />
    <bpmn:userTask id="ProcessPayment" name="Process Payment">
      <bpmn:incoming>Exp_Flow_Payment</bpmn:incoming>
      <bpmn:outgoing>Exp_Flow_PayJoin</bpmn:outgoing>
      <bpmn:documentation>Finance processes the expense payment</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:userTask id="ArchiveRecord" name="Archive Record">
      <bpmn:incoming>Exp_Flow_Archive</bpmn:incoming>
      <bpmn:outgoing>Exp_Flow_ArcJoin</bpmn:outgoing>
      <bpmn:documentation>Archive the expense record for audit</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:parallelGateway id="ParallelJoin" name="Parallel Join">
      <bpmn:incoming>Exp_Flow_PayJoin</bpmn:incoming>
      <bpmn:incoming>Exp_Flow_ArcJoin</bpmn:incoming>
      <bpmn:outgoing>Exp_Flow_End</bpmn:outgoing>
    </bpmn:parallelGateway>
    <bpmn:sequenceFlow id="Exp_Flow_PayJoin" sourceRef="ProcessPayment" targetRef="ParallelJoin" />
    <bpmn:sequenceFlow id="Exp_Flow_ArcJoin" sourceRef="ArchiveRecord" targetRef="ParallelJoin" />
    <bpmn:sequenceFlow id="Exp_Flow_End" sourceRef="ParallelJoin" targetRef="Exp_EndEvent" />
    <bpmn:endEvent id="Exp_EndEvent" name="Completed">
      <bpmn:incoming>Exp_Flow_End</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>
</bpmn:definitions>`;

  const expenseProcess = await prisma.process.create({
    data: {
      name: 'Expense Approval',
      description: 'Expense claim workflow with inclusive gateway (amount routing + compliance), parallel finalization (payment + archive)',
      bpmnXml: expenseBpmnXml,
      version: 1,
      status: 'ACTIVE',
      createdById: admin.id,
    },
  });

  // Bind expense process tasks to POSITIONS (not users) and forms.
  // This demonstrates position-based assignment: any user holding the
  // position can complete the task.
  //
  // selfService=true means the task must be CLAIMED before it can be completed.
  // We mark the approval tasks as self-service so that once a manager/director
  // starts reviewing, others can't interfere.
  //
  // Associate forms with this process (process-scoped forms)
  await prisma.form.update({ where: { id: expenseForm.id }, data: { processId: expenseProcess.id } });
  await prisma.form.update({ where: { id: paymentForm.id }, data: { processId: expenseProcess.id } });
  await prisma.form.update({ where: { id: archiveForm.id }, data: { processId: expenseProcess.id } });

  // Create a separate approval form for the expense process
  const expenseApprovalForm = await prisma.form.create({
    data: {
      name: 'Expense Approval Form',
      description: 'Form used by manager/director to approve expenses',
      processId: expenseProcess.id,
      fields: JSON.stringify([
        { name: 'decision', label: 'Decision', type: 'select', required: true, options: ['Approve', 'Reject'], variable: 'decision' },
        { name: 'comment', label: 'Comment', type: 'textarea', required: false, variable: 'comment' },
      ]),
    },
  });

  await prisma.taskAssignment.create({
    data: { processId: expenseProcess.id, taskName: 'Submit Expense', positionId: engEmployee.id, formId: expenseForm.id },
  });
  await prisma.taskAssignment.create({
    data: { processId: expenseProcess.id, taskName: 'Manager Approve', positionId: engManager.id, selfService: true, formId: expenseApprovalForm.id },
  });
  await prisma.taskAssignment.create({
    data: { processId: expenseProcess.id, taskName: 'Director Approve', positionId: engDirector.id, selfService: true, formId: expenseApprovalForm.id },
  });
  await prisma.taskAssignment.create({
    data: { processId: expenseProcess.id, taskName: 'Compliance Review', positionId: complianceOfficer.id, selfService: true, formId: expenseApprovalForm.id },
  });
  // Process Payment and Archive Record are NOT self-service — any holder can
  // complete directly (faster for routine tasks)
  await prisma.taskAssignment.create({
    data: { processId: expenseProcess.id, taskName: 'Process Payment', positionId: finOfficer.id, formId: paymentForm.id },
  });
  await prisma.taskAssignment.create({
    data: { processId: expenseProcess.id, taskName: 'Archive Record', positionId: engDirector.id, formId: archiveForm.id },
  });

  console.log(`Created process: ${expenseProcess.name} (id=${expenseProcess.id})`);
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
