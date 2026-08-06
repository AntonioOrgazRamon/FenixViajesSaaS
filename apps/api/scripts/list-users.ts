import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      firstName: true,
      lastName: true,
      companyId: true,
      createdAt: true,
    },
  });

  console.log(`Total: ${users.length}\n`);
  for (const u of users) {
    console.log(
      `${u.email} | ${u.role} | ${u.status} | ${u.firstName} ${u.lastName} | companyId=${u.companyId ?? '—'} | ${u.id}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
