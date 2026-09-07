/**
 * Patch the EXISTING database: add read-only display fields to the leave
 * process's Approval Form so the approver sees the employee's submitted
 * data (filled in the previous "Submit Request" task) as locked fields.
 *
 * Field metadata (label/type/categoryId/options/variable) is mirrored from
 * the Leave Request Form so value/label semantics stay identical.
 * Idempotent: skips field names that already exist on the approval form.
 *
 * Run: bun scripts/add-readonly-approval-fields.cjs   (from mini-services/bpms-backend)
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const MIRROR_NAMES = ['employeeName', 'leaveType', 'startDate', 'endDate', 'reason'];

async function main() {
  // 1. Locate the approval form via the Leave process's "Approve Request" assignment
  const assignment = await prisma.taskAssignment.findFirst({
    where: { taskName: 'Approve Request' },
    include: { form: true, process: true },
  });
  if (!assignment || !assignment.form) {
    throw new Error('Could not find the Approve Request task assignment (or it has no form)');
  }
  const approvalForm = assignment.form;

  // 2. Locate the request form via the "Submit Request" assignment (metadata source)
  const requestAssignment = await prisma.taskAssignment.findFirst({
    where: { taskName: 'Submit Request' },
    include: { form: true },
  });
  if (!requestAssignment || !requestAssignment.form) {
    throw new Error('Could not find the Submit Request task assignment (or it has no form)');
  }
  const requestForm = requestAssignment.form;

  const requestFields = JSON.parse(requestForm.fields);
  const approvalFields = JSON.parse(approvalForm.fields);
  const existingNames = new Set(approvalFields.map((f) => f.name));

  // 3. Build read-only mirrors (only for names not already present)
  const mirrors = [];
  for (const name of MIRROR_NAMES) {
    if (existingNames.has(name)) {
      console.log(`- skip "${name}" (already exists on approval form)`);
      continue;
    }
    const src = requestFields.find((f) => f.name === name);
    if (!src) {
      console.log(`- skip "${name}" (not found on request form)`);
      continue;
    }
    mirrors.push({
      name: src.name,
      label: src.label,
      type: src.type,
      required: false,
      readOnly: true,
      ...(src.categoryId ? { categoryId: src.categoryId } : {}),
      ...(src.options ? { options: src.options } : {}),
      ...(src.variable ? { variable: src.variable } : {}),
    });
  }

  if (mirrors.length === 0) {
    console.log('Nothing to patch — approval form already has all mirror fields.');
    return;
  }

  // 4. Read-only mirrors first, then the editable fields
  const nextFields = [...mirrors, ...approvalFields];
  await prisma.form.update({
    where: { id: approvalForm.id },
    data: { fields: JSON.stringify(nextFields) },
  });

  console.log(
    `Patched approval form "${approvalForm.name}" (${approvalForm.id}) of process "${assignment.process.name}":\n` +
      `  + ${mirrors.map((m) => `${m.name}(${m.type}, readOnly)`).join(', ')}\n` +
      `  total fields: ${nextFields.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
