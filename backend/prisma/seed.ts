/**
 * BPMS seed — فرآیند نمونه «درخواست خدمات IT».
 *
 * Strategy:
 *   - USERS ARE PRESERVED (looked up by username, then email). Missing ones are created.
 *   - EVERYTHING ELSE is wiped, then a complete Persian IT service-request
 *     process is seeded end-to-end.
 *
 * Feasibility with current engine (YES):
 *   - Category dropdown for request type ………………… Category + form select
 *   - Pool of IT experts, first claim wins …………… POSITION + selfService
 *   - Return to the SAME expert after manager ……… TASK_STARTER(source=بررسی)
 *   - Return to requester for final confirm ……… TASK_STARTER(source=ثبت)
 *   - Requester reject → expert redo ……………… exclusiveGateway + loop
 *   - Manager reject → expert re-review …………… exclusiveGateway + loop
 *
 * Flow:
 *   شروع → ثبت درخواست خدمات IT
 *        → بررسی کارشناس IT  (position pool, خودخدمت)
 *        → تایید مدیر IT
 *        → XOR«تصمیم مدیر»
 *             ├─ تایید → انجام کار کارشناس (همان کارشناس)
 *             └─ رد    → بررسی کارشناس IT (دوباره)
 *        → تایید درخواست‌دهنده
 *        → XOR«تصمیم درخواست‌دهنده»
 *             ├─ تایید → پایان
 *             └─ رد    → انجام کار کارشناس (دوباره)
 *
 * Seeded accounts (password unchanged if already present):
 *   admin / admin123   — ADMIN
 *   john  / user123    — درخواست‌کننده
 *   jane  / user123    — کارشناس IT ۱
 *   ali   / user123    — کارشناس IT ۲  (created if missing)
 *   bob   / user123    — مدیر IT
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';
import { PrismaClient, UserRole } from '../src/common/infrastructure/database/generated/prisma/client.js';

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./db/bpms.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database (IT service request process)...');

  // -----------------------------------------------------------------------
  // 1) WIPE everything EXCEPT users (FK-safe order)
  // -----------------------------------------------------------------------
  await prisma.formSubmission.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.reportDefinition.deleteMany();
  await prisma.processStarter.deleteMany();
  await prisma.processDraft.deleteMany();
  await prisma.processInstance.deleteMany();
  await prisma.processVariable.deleteMany();
  await prisma.processVersion.deleteMany();
  await prisma.process.deleteMany();
  await prisma.form.deleteMany();
  await prisma.categoryItem.deleteMany();
  await prisma.category.deleteMany();
  await prisma.userPosition.deleteMany();
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();
  console.log(
    '🧹 Cleared: submissions, tasks, assignments, reports, starters, drafts, instances, variables, versions, processes, forms, categories, positions, departments (users preserved)',
  );

  // -----------------------------------------------------------------------
  // 2) Users
  // -----------------------------------------------------------------------
  const ensureUser = async (
    username: string,
    email: string,
    name: string,
    plainPassword: string,
    role: UserRole,
  ) => {
    const normalized = username.trim().toLowerCase();
    const existing =
      (await prisma.user.findUnique({ where: { username: normalized } })) ??
      (await prisma.user.findUnique({ where: { email } }));
    if (existing) {
      if (existing.username !== normalized) {
        return prisma.user.update({
          where: { id: existing.id },
          data: { username: normalized },
        });
      }
      return existing;
    }
    return prisma.user.create({
      data: {
        username: normalized,
        email,
        name,
        password: await bcrypt.hash(plainPassword, 10),
        role,
      },
    });
  };

  const admin = await ensureUser('admin', 'admin@bpms.local', 'System Admin', 'admin123', UserRole.ADMIN);
  const john = await ensureUser('john', 'john@bpms.local', 'جان — درخواست‌کننده', 'user123', UserRole.USER);
  const jane = await ensureUser('jane', 'jane@bpms.local', 'جین — کارشناس IT', 'user123', UserRole.USER);
  const ali = await ensureUser('ali', 'ali@bpms.local', 'علی — کارشناس IT', 'user123', UserRole.USER);
  const bob = await ensureUser('bob', 'bob@bpms.local', 'باب — مدیر IT', 'user123', UserRole.USER);
  console.log(
    `👤 Users: ${admin.username}, ${john.username}, ${jane.username}, ${ali.username}, ${bob.username}`,
  );

  // -----------------------------------------------------------------------
  // 3) Org: IT department + کارشناس IT (2 holders) + مدیر IT
  // -----------------------------------------------------------------------
  const itDept = await prisma.department.create({
    data: {
      name: 'فناوری اطلاعات',
      description: 'واحد پشتیبانی و خدمات فناوری اطلاعات',
    },
  });
  const adminDept = await prisma.department.create({
    data: {
      name: 'اداری',
      description: 'واحد اداری — درخواست‌کنندگان خدمات',
    },
  });

  const itExpertPos = await prisma.position.create({
    data: {
      departmentId: itDept.id,
      name: 'کارشناس IT',
      description: 'کارشناس پشتیبانی فناوری اطلاعات',
    },
  });
  const itManagerPos = await prisma.position.create({
    data: {
      departmentId: itDept.id,
      name: 'مدیر IT',
      description: 'مدیر واحد فناوری اطلاعات',
      isManager: true,
    },
  });
  const staffPos = await prisma.position.create({
    data: {
      departmentId: adminDept.id,
      name: 'کارشناس اداری',
      description: 'کارشناس واحد اداری (درخواست‌کننده)',
    },
  });

  await prisma.userPosition.create({ data: { userId: john.id, positionId: staffPos.id } });
  await prisma.userPosition.create({ data: { userId: jane.id, positionId: itExpertPos.id } });
  await prisma.userPosition.create({ data: { userId: ali.id, positionId: itExpertPos.id } });
  await prisma.userPosition.create({ data: { userId: bob.id, positionId: itManagerPos.id } });
  console.log('🏢 Departments: فناوری اطلاعات، اداری — کارشناس IT ← jane+ali ، مدیر IT ← bob ، درخواست‌کننده ← john');

  // -----------------------------------------------------------------------
  // 4) Category — طبقه‌بندی انواع درخواست IT
  // -----------------------------------------------------------------------
  const requestTypes = await prisma.category.create({
    data: {
      key: 'it_request_types',
      name: 'طبقه‌بندی درخواست‌های IT',
      description: 'انواع درخواست خدمات فناوری اطلاعات',
      items: {
        create: [
          { value: 'Hardware', label: 'سخت‌افزار', sortOrder: 0 },
          { value: 'Software', label: 'نرم‌افزار', sortOrder: 1 },
          { value: 'Network', label: 'شبکه و اینترنت', sortOrder: 2 },
          { value: 'Access', label: 'دسترسی و حساب کاربری', sortOrder: 3 },
          { value: 'Other', label: 'سایر', sortOrder: 4 },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`🗂️ Category «طبقه‌بندی درخواست‌های IT» — ${requestTypes.items.length} items`);

  // -----------------------------------------------------------------------
  // 5) BPMN — IT service request with manager + requester decision loops
  // -----------------------------------------------------------------------
  const bpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="Definitions_ItServiceFa" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="ItServiceRequestProcess" name="فرآیند درخواست خدمات IT" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="شروع">
      <bpmn:outgoing>Flow_Start</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:sequenceFlow id="Flow_Start" sourceRef="StartEvent_1" targetRef="SubmitItRequest" />

    <bpmn:userTask id="SubmitItRequest" name="ثبت درخواست خدمات IT">
      <bpmn:incoming>Flow_Start</bpmn:incoming>
      <bpmn:outgoing>Flow_ToExpertReview</bpmn:outgoing>
      <bpmn:documentation>درخواست‌کننده نوع درخواست و توضیحات را ثبت می‌کند</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_ToExpertReview" sourceRef="SubmitItRequest" targetRef="ExpertReview" />

    <bpmn:userTask id="ExpertReview" name="بررسی کارشناس IT">
      <bpmn:incoming>Flow_ToExpertReview</bpmn:incoming>
      <bpmn:incoming>Flow_MgrReject</bpmn:incoming>
      <bpmn:outgoing>Flow_ToManager</bpmn:outgoing>
      <bpmn:documentation>کارشناس IT (خودخدمت) درخواست را برمی‌دارد و نظر خود را ثبت می‌کند</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_ToManager" sourceRef="ExpertReview" targetRef="ManagerApproval" />

    <bpmn:userTask id="ManagerApproval" name="تایید مدیر IT">
      <bpmn:incoming>Flow_ToManager</bpmn:incoming>
      <bpmn:outgoing>Flow_ToMgrGateway</bpmn:outgoing>
      <bpmn:documentation>مدیر IT درخواست را تایید یا رد می‌کند</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_ToMgrGateway" sourceRef="ManagerApproval" targetRef="ManagerGateway" />

    <bpmn:exclusiveGateway id="ManagerGateway" name="تصمیم مدیر">
      <bpmn:incoming>Flow_ToMgrGateway</bpmn:incoming>
      <bpmn:outgoing>Flow_MgrApprove</bpmn:outgoing>
      <bpmn:outgoing>Flow_MgrReject</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="Flow_MgrApprove" name="تایید" sourceRef="ManagerGateway" targetRef="ExpertWork">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.managerDecision === 'Approve');</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_MgrReject" name="رد" sourceRef="ManagerGateway" targetRef="ExpertReview">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.managerDecision === 'Reject');</bpmn:conditionExpression>
    </bpmn:sequenceFlow>

    <bpmn:userTask id="ExpertWork" name="انجام کار کارشناس">
      <bpmn:incoming>Flow_MgrApprove</bpmn:incoming>
      <bpmn:incoming>Flow_ReqReject</bpmn:incoming>
      <bpmn:outgoing>Flow_ToRequester</bpmn:outgoing>
      <bpmn:documentation>همان کارشناس کار را انجام می‌دهد و توضیحات انجام کار را ثبت می‌کند</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_ToRequester" sourceRef="ExpertWork" targetRef="RequesterConfirm" />

    <bpmn:userTask id="RequesterConfirm" name="تایید درخواست‌دهنده">
      <bpmn:incoming>Flow_ToRequester</bpmn:incoming>
      <bpmn:outgoing>Flow_ToReqGateway</bpmn:outgoing>
      <bpmn:documentation>درخواست‌دهنده نتیجه را تایید یا برای انجام دوباره رد می‌کند</bpmn:documentation>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="Flow_ToReqGateway" sourceRef="RequesterConfirm" targetRef="RequesterGateway" />

    <bpmn:exclusiveGateway id="RequesterGateway" name="تصمیم درخواست‌دهنده">
      <bpmn:incoming>Flow_ToReqGateway</bpmn:incoming>
      <bpmn:outgoing>Flow_ReqApprove</bpmn:outgoing>
      <bpmn:outgoing>Flow_ReqReject</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:sequenceFlow id="Flow_ReqApprove" name="تایید" sourceRef="RequesterGateway" targetRef="EndCompleted">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.requesterDecision === 'Approve');</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_ReqReject" name="رد" sourceRef="RequesterGateway" targetRef="ExpertWork">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" language="javascript">next(null, environment.variables.requesterDecision === 'Reject');</bpmn:conditionExpression>
    </bpmn:sequenceFlow>

    <bpmn:endEvent id="EndCompleted" name="پایان: تکمیل شد">
      <bpmn:incoming>Flow_ReqApprove</bpmn:incoming>
    </bpmn:endEvent>
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_ItServiceFa">
    <bpmndi:BPMNPlane id="BPMNPlane_ItServiceFa" bpmnElement="ItServiceRequestProcess">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="152" y="202" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="SubmitItRequest_di" bpmnElement="SubmitItRequest">
        <dc:Bounds x="230" y="180" width="110" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ExpertReview_di" bpmnElement="ExpertReview">
        <dc:Bounds x="390" y="180" width="110" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ManagerApproval_di" bpmnElement="ManagerApproval">
        <dc:Bounds x="550" y="180" width="110" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ManagerGateway_di" bpmnElement="ManagerGateway" isMarkerVisible="true">
        <dc:Bounds x="712" y="195" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="ExpertWork_di" bpmnElement="ExpertWork">
        <dc:Bounds x="810" y="180" width="110" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="RequesterConfirm_di" bpmnElement="RequesterConfirm">
        <dc:Bounds x="970" y="180" width="120" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="RequesterGateway_di" bpmnElement="RequesterGateway" isMarkerVisible="true">
        <dc:Bounds x="1142" y="195" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndCompleted_di" bpmnElement="EndCompleted">
        <dc:Bounds x="1242" y="202" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_Start_di" bpmnElement="Flow_Start">
        <di:waypoint x="188" y="220" /><di:waypoint x="230" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ToExpertReview_di" bpmnElement="Flow_ToExpertReview">
        <di:waypoint x="340" y="220" /><di:waypoint x="390" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ToManager_di" bpmnElement="Flow_ToManager">
        <di:waypoint x="500" y="220" /><di:waypoint x="550" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ToMgrGateway_di" bpmnElement="Flow_ToMgrGateway">
        <di:waypoint x="660" y="220" /><di:waypoint x="712" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_MgrApprove_di" bpmnElement="Flow_MgrApprove">
        <di:waypoint x="762" y="220" /><di:waypoint x="810" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_MgrReject_di" bpmnElement="Flow_MgrReject">
        <di:waypoint x="737" y="245" /><di:waypoint x="737" y="320" /><di:waypoint x="445" y="320" /><di:waypoint x="445" y="260" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ToRequester_di" bpmnElement="Flow_ToRequester">
        <di:waypoint x="920" y="220" /><di:waypoint x="970" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ToReqGateway_di" bpmnElement="Flow_ToReqGateway">
        <di:waypoint x="1090" y="220" /><di:waypoint x="1142" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ReqApprove_di" bpmnElement="Flow_ReqApprove">
        <di:waypoint x="1192" y="220" /><di:waypoint x="1242" y="220" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_ReqReject_di" bpmnElement="Flow_ReqReject">
        <di:waypoint x="1167" y="245" /><di:waypoint x="1167" y="360" /><di:waypoint x="865" y="360" /><di:waypoint x="865" y="260" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  // -----------------------------------------------------------------------
  // 6) Process + forms + variables + assignments
  // -----------------------------------------------------------------------
  const process = await prisma.process.create({
    data: {
      name: 'فرآیند درخواست خدمات IT',
      description:
        'نمونه کامل درخواست خدمات فناوری اطلاعات: ثبت → کارشناس (خودخدمت) → مدیر → انجام کار → تایید درخواست‌دهنده با امکان برگشت',
      bpmnXml,
      version: 1,
      status: 'ACTIVE',
      createdById: admin.id,
      versions: {
        create: { version: 1, bpmnXml, createdById: admin.id, note: 'نسخه اولیه — درخواست خدمات IT' },
      },
    },
  });

  const submitForm = await prisma.form.create({
    data: {
      name: 'فرم ثبت درخواست خدمات IT',
      description: 'فرم اولیه درخواست‌کننده',
      processId: process.id,
      fields: JSON.stringify([
        {
          name: 'requestType',
          label: 'نوع درخواست',
          type: 'select',
          required: true,
          categoryId: requestTypes.id,
          options: ['Hardware', 'Software', 'Network', 'Access', 'Other'],
        },
        { name: 'description', label: 'توضیحات درخواست', type: 'textarea', required: true },
        { name: 'attachments', label: 'پیوست', type: 'file', required: false, multiple: true },
      ]),
    },
  });

  const expertReviewForm = await prisma.form.create({
    data: {
      name: 'فرم بررسی کارشناس IT',
      description: 'کارشناس پس از ادعا، نظر فنی خود را ثبت می‌کند',
      processId: process.id,
      fields: JSON.stringify([
        {
          name: 'requestType',
          label: 'نوع درخواست',
          type: 'select',
          required: false,
          readOnly: true,
          categoryId: requestTypes.id,
          options: ['Hardware', 'Software', 'Network', 'Access', 'Other'],
        },
        { name: 'description', label: 'توضیحات درخواست', type: 'textarea', required: false, readOnly: true },
        { name: 'attachments', label: 'پیوست‌های درخواست', type: 'file', required: false, readOnly: true, multiple: true },
        { name: 'expertNote', label: 'توضیحات کارشناس', type: 'textarea', required: true },
      ]),
    },
  });

  const managerForm = await prisma.form.create({
    data: {
      name: 'فرم تایید مدیر IT',
      description: 'مدیر IT درخواست را تایید یا رد می‌کند',
      processId: process.id,
      fields: JSON.stringify([
        {
          name: 'requestType',
          label: 'نوع درخواست',
          type: 'select',
          required: false,
          readOnly: true,
          categoryId: requestTypes.id,
          options: ['Hardware', 'Software', 'Network', 'Access', 'Other'],
        },
        { name: 'description', label: 'توضیحات درخواست', type: 'textarea', required: false, readOnly: true },
        { name: 'expertNote', label: 'توضیحات کارشناس', type: 'textarea', required: false, readOnly: true },
        {
          name: 'managerDecision',
          label: 'تصمیم مدیر',
          type: 'select',
          required: true,
          options: ['Approve', 'Reject'],
        },
        { name: 'managerComment', label: 'نظر مدیر', type: 'textarea', required: false },
      ]),
    },
  });

  const workForm = await prisma.form.create({
    data: {
      name: 'فرم انجام کار کارشناس',
      description: 'کارشناس پس از انجام کار، گزارش می‌دهد',
      processId: process.id,
      fields: JSON.stringify([
        {
          name: 'requestType',
          label: 'نوع درخواست',
          type: 'select',
          required: false,
          readOnly: true,
          categoryId: requestTypes.id,
          options: ['Hardware', 'Software', 'Network', 'Access', 'Other'],
        },
        { name: 'description', label: 'توضیحات درخواست', type: 'textarea', required: false, readOnly: true },
        { name: 'expertNote', label: 'توضیحات بررسی اولیه', type: 'textarea', required: false, readOnly: true },
        { name: 'managerComment', label: 'نظر مدیر', type: 'textarea', required: false, readOnly: true },
        { name: 'workNote', label: 'توضیحات انجام کار', type: 'textarea', required: true },
      ]),
    },
  });

  const confirmForm = await prisma.form.create({
    data: {
      name: 'فرم تایید درخواست‌دهنده',
      description: 'درخواست‌دهنده نتیجه کار را تایید یا رد می‌کند',
      processId: process.id,
      fields: JSON.stringify([
        {
          name: 'requestType',
          label: 'نوع درخواست',
          type: 'select',
          required: false,
          readOnly: true,
          categoryId: requestTypes.id,
          options: ['Hardware', 'Software', 'Network', 'Access', 'Other'],
        },
        { name: 'description', label: 'توضیحات درخواست', type: 'textarea', required: false, readOnly: true },
        { name: 'workNote', label: 'توضیحات انجام کار', type: 'textarea', required: false, readOnly: true },
        {
          name: 'requesterDecision',
          label: 'تصمیم شما',
          type: 'select',
          required: true,
          options: ['Approve', 'Reject'],
        },
        { name: 'requesterComment', label: 'نظر درخواست‌دهنده', type: 'textarea', required: false },
      ]),
    },
  });

  await prisma.processVariable.createMany({
    data: [
      { processId: process.id, name: 'requestType', label: 'نوع درخواست', type: 'select' },
      { processId: process.id, name: 'description', label: 'توضیحات درخواست', type: 'text' },
      { processId: process.id, name: 'expertNote', label: 'توضیحات کارشناس', type: 'text' },
      { processId: process.id, name: 'managerDecision', label: 'تصمیم مدیر', type: 'select' },
      { processId: process.id, name: 'managerComment', label: 'نظر مدیر', type: 'text' },
      { processId: process.id, name: 'workNote', label: 'توضیحات انجام کار', type: 'text' },
      { processId: process.id, name: 'requesterDecision', label: 'تصمیم درخواست‌دهنده', type: 'select' },
      { processId: process.id, name: 'requesterComment', label: 'نظر درخواست‌دهنده', type: 'text' },
    ],
  });

  // Gateway option labels shown in UI are Persian via category/options display;
  // engine conditions use stable English values Approve/Reject.
  // For select fields with options ['Approve','Reject'] the UI shows those
  // strings — map Persian labels via inline options is English; better use
  // value/label pairs isn't supported for inline options (only string[]).
  // Keep Approve/Reject as values; Persian UI can be improved later with a category.
  // Add a small category for decisions so Persian labels show in forms.
  const decisions = await prisma.category.create({
    data: {
      key: 'approve_reject',
      name: 'تایید / رد',
      description: 'گزینه‌های تصمیم تایید یا رد',
      items: {
        create: [
          { value: 'Approve', label: 'تایید', sortOrder: 0 },
          { value: 'Reject', label: 'رد', sortOrder: 1 },
        ],
      },
    },
  });

  // Patch manager + confirm forms to use the decision category (Persian labels)
  await prisma.form.update({
    where: { id: managerForm.id },
    data: {
      fields: JSON.stringify([
        {
          name: 'requestType',
          label: 'نوع درخواست',
          type: 'select',
          required: false,
          readOnly: true,
          categoryId: requestTypes.id,
          options: ['Hardware', 'Software', 'Network', 'Access', 'Other'],
        },
        { name: 'description', label: 'توضیحات درخواست', type: 'textarea', required: false, readOnly: true },
        { name: 'expertNote', label: 'توضیحات کارشناس', type: 'textarea', required: false, readOnly: true },
        {
          name: 'managerDecision',
          label: 'تصمیم مدیر',
          type: 'select',
          required: true,
          categoryId: decisions.id,
          options: ['Approve', 'Reject'],
        },
        { name: 'managerComment', label: 'نظر مدیر', type: 'textarea', required: false },
      ]),
    },
  });
  await prisma.form.update({
    where: { id: confirmForm.id },
    data: {
      fields: JSON.stringify([
        {
          name: 'requestType',
          label: 'نوع درخواست',
          type: 'select',
          required: false,
          readOnly: true,
          categoryId: requestTypes.id,
          options: ['Hardware', 'Software', 'Network', 'Access', 'Other'],
        },
        { name: 'description', label: 'توضیحات درخواست', type: 'textarea', required: false, readOnly: true },
        { name: 'workNote', label: 'توضیحات انجام کار', type: 'textarea', required: false, readOnly: true },
        {
          name: 'requesterDecision',
          label: 'تصمیم شما',
          type: 'select',
          required: true,
          categoryId: decisions.id,
          options: ['Approve', 'Reject'],
        },
        { name: 'requesterComment', label: 'نظر درخواست‌دهنده', type: 'textarea', required: false },
      ]),
    },
  });

  await prisma.taskAssignment.createMany({
    data: [
      // First step: whoever started the instance (draft submit / initiator)
      {
        processId: process.id,
        taskName: 'ثبت درخواست خدمات IT',
        strategy: 'INITIATOR',
        formId: submitForm.id,
      },
      // IT expert pool — first claim wins (selfService)
      {
        processId: process.id,
        taskName: 'بررسی کارشناس IT',
        strategy: 'POSITION',
        positionId: itExpertPos.id,
        selfService: true,
        formId: expertReviewForm.id,
      },
      // IT manager (bob)
      {
        processId: process.id,
        taskName: 'تایید مدیر IT',
        strategy: 'FIXED_USER',
        assigneeId: bob.id,
        formId: managerForm.id,
      },
      // Same expert who claimed/completed «بررسی کارشناس IT»
      {
        processId: process.id,
        taskName: 'انجام کار کارشناس',
        strategy: 'TASK_STARTER',
        sourceTaskName: 'بررسی کارشناس IT',
        formId: workForm.id,
      },
      // Back to the requester who submitted
      {
        processId: process.id,
        taskName: 'تایید درخواست‌دهنده',
        strategy: 'TASK_STARTER',
        sourceTaskName: 'ثبت درخواست خدمات IT',
        formId: confirmForm.id,
      },
    ],
  });

  console.log(`📋 Process «فرآیند درخواست خدمات IT» created (id=${process.id})`);
  console.log('📝 Forms: ثبت، بررسی کارشناس، تایید مدیر، انجام کار، تایید درخواست‌دهنده');
  console.log(
    '🔗 Assignments: INITIATOR → POSITION(selfService) → FIXED_USER(bob) → TASK_STARTER(expert) → TASK_STARTER(requester)',
  );

  // -----------------------------------------------------------------------
  // 7) Sample report
  // -----------------------------------------------------------------------
  await prisma.reportDefinition.create({
    data: {
      name: 'گزارش درخواست‌های IT',
      description: 'نوع درخواست، تصمیم مدیر و تصمیم درخواست‌دهنده',
      processId: process.id,
      createdById: admin.id,
      columns: JSON.stringify([
        { key: 'field:status', source: 'INSTANCE', fieldKey: 'status' },
        { key: 'field:startedBy', source: 'INSTANCE', fieldKey: 'startedBy' },
        { key: 'field:startedAt', source: 'INSTANCE', fieldKey: 'startedAt' },
        { key: 'var:requestType', source: 'VARIABLE', fieldKey: 'requestType' },
        { key: 'var:managerDecision', source: 'VARIABLE', fieldKey: 'managerDecision' },
        { key: 'var:requesterDecision', source: 'VARIABLE', fieldKey: 'requesterDecision' },
        { key: 'var:workNote', source: 'VARIABLE', fieldKey: 'workNote' },
      ]),
      filters: JSON.stringify([]),
    },
  });
  console.log('📊 Report «گزارش درخواست‌های IT» seeded');
  console.log('✅ Seeding complete.');
  console.log('');
  console.log('How to try:');
  console.log('  1. Login as john / user123 → شروع فرآیند → ثبت درخواست');
  console.log('  2. Login as jane OR ali → کارتابل → ادعا → بررسی');
  console.log('  3. Login as bob → تایید مدیر');
  console.log('  4. Same expert → انجام کار');
  console.log('  5. john → تایید نهایی (یا رد برای انجام دوباره)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
