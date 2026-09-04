const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const sub = await p.formSubmission.findFirst({ orderBy: { submittedAt: 'desc' } });
  console.log('latest submission:', sub.data, 'at', sub.submittedAt.toISOString());
  const task = await p.task.findUnique({ where: { id: sub.taskId } });
  console.log('belongs to instance:', task.processInstanceId);
  const inst = await p.processInstance.findUnique({
    where: { id: task.processInstanceId },
    include: { tasks: { orderBy: { createdAt: 'asc' } } },
  });
  console.log('instance status:', inst.status);
  inst.tasks.forEach(t => console.log('  task:', t.name, '|', t.status, '| completedAt:', t.completedAt && t.completedAt.toISOString()));
  await p.$disconnect();
})();
