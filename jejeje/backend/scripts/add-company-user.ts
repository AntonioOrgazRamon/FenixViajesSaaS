/**
 * Crea un usuario vinculado a una empresa existente (por slug).
 * Uso (PowerShell):
 *   $env:COMPANY_SLUG="fenixviajes"
 *   $env:USER_EMAIL="..."; $env:USER_PASSWORD="..."; npx ts-node --transpile-only scripts/add-company-user.ts
 *
 * Requerido: USER_EMAIL, USER_PASSWORD
 * Opcional: COMPANY_SLUG (default: fenixviajes), USER_FIRST_NAME, USER_LAST_NAME, USER_ROLE (COMPANY_USER|COMPANY_ADMIN, default: COMPANY_USER)
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const companySlug = process.env.COMPANY_SLUG ?? 'fenixviajes';
const email = process.env.USER_EMAIL;
const password = process.env.USER_PASSWORD;
const firstName = process.env.USER_FIRST_NAME ?? 'Usuario';
const lastName = process.env.USER_LAST_NAME ?? 'Nuevo';
const roleRaw = (process.env.USER_ROLE ?? 'COMPANY_USER').toUpperCase();

if (!email || !password) {
  console.error('Define USER_EMAIL y USER_PASSWORD');
  process.exit(1);
}

if (roleRaw !== 'COMPANY_USER' && roleRaw !== 'COMPANY_ADMIN') {
  console.error('USER_ROLE debe ser COMPANY_USER o COMPANY_ADMIN');
  process.exit(1);
}

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) {
    throw new Error(`No hay empresa con slug "${companySlug}".`);
  }
  if (company.status !== 'ACTIVE') {
    throw new Error(`La empresa ${companySlug} no está activa.`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error(`El email ${email} ya está registrado.`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email,
      passwordHash,
      firstName,
      lastName,
      role: roleRaw,
      status: 'ACTIVE',
    },
  });

  console.log('Usuario creado:', user.id, user.email, '→', company.name, `(${roleRaw})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
