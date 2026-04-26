/**
 * Uso: USER_EMAIL=... USER_ROLE=COMPANY_ADMIN npx ts-node --transpile-only scripts/set-user-role.ts
 */
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.env.USER_EMAIL;
const role = process.env.USER_ROLE as Role;

if (!email || !role || !['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_USER'].includes(role)) {
  console.error('USER_EMAIL y USER_ROLE (COMPANY_ADMIN|COMPANY_USER|SUPER_ADMIN) requeridos');
  process.exit(1);
}

async function main() {
  const u = await prisma.user.update({ where: { email }, data: { role } });
  console.log('Rol actualizado:', u.email, u.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
