import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const tenant = await prisma.tenant.findFirst();
  console.log('Tenant:', tenant?.id, tenant?.name);
}
main().catch(console.error).finally(() => prisma.$disconnect());
