/**
 * Datos demo: empresa fenixviajes + 3 usuarios.
 * Uso: npx ts-node --transpile-only scripts/seed-fenixviajes.ts
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANY = { name: 'Fenix Viajes', slug: 'fenixviajes' };

const USERS = [
  {
    email: 'fenixviajes@prueba.com',
    password: 'fenixviajes',
    firstName: 'Fenix',
    lastName: 'Viajes',
    role: 'COMPANY_ADMIN' as const,
  },
  {
    email: 'adrian@adrian.com',
    password: 'adrian',
    firstName: 'Adrian',
    lastName: 'Admin',
    role: 'COMPANY_ADMIN' as const,
  },
  {
    email: 'adrian@normal.com',
    password: 'adrian',
    firstName: 'Adrian',
    lastName: 'Usuario',
    role: 'COMPANY_USER' as const,
  },
];

async function main() {
  const existingSlug = await prisma.company.findUnique({ where: { slug: COMPANY.slug } });
  if (existingSlug) {
    throw new Error(`Ya existe una empresa con slug "${COMPANY.slug}". Elimínala o cambia el slug en el script.`);
  }

  for (const u of USERS) {
    const taken = await prisma.user.findUnique({ where: { email: u.email } });
    if (taken) {
      throw new Error(`El email ${u.email} ya está registrado.`);
    }
  }

  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
  });

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: COMPANY.name,
        slug: COMPANY.slug,
        createdBy: superAdmin?.id ?? undefined,
      },
    });

    for (const u of USERS) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      await tx.user.create({
        data: {
          companyId: company.id,
          email: u.email,
          passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          status: 'ACTIVE',
        },
      });
    }

    if (superAdmin) {
      await tx.auditLog.create({
        data: {
          actorUserId: superAdmin.id,
          actorRole: 'SUPER_ADMIN',
          companyId: company.id,
          action: 'COMPANY_CREATED',
          targetType: 'COMPANY',
          targetId: company.id,
          result: 'SUCCESS',
        },
      });
    }
  });

  console.log('Empresa creada:', COMPANY.slug);
  console.log('Usuarios:');
  for (const u of USERS) {
    console.log(`  - ${u.email} (${u.role})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
