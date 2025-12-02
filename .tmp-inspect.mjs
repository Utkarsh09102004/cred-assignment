import { prisma } from './src/lib/prisma.js';
const run = async () => {
  const conv = await prisma.conversation.findMany({ include: { versions: true } });
  console.log(JSON.stringify(conv, null, 2));
  await prisma.$disconnect();
};
run();
