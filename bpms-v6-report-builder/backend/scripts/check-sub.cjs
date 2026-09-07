const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const subs = await p.formSubmission.findMany({ orderBy: { submittedAt: 'desc' }, take: 2 });
  subs.forEach(s => console.log(s.submittedAt.toISOString(), '|', s.data));
  await p.$disconnect();
})();
