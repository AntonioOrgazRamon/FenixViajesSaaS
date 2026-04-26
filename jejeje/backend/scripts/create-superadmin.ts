/**
 * Crea un usuario SUPER_ADMIN (sin empresa).
 * Uso (PowerShell):
 *   $env:SUPERADMIN_EMAIL="tu@email.com"; $env:SUPERADMIN_PASSWORD="..."; npx ts-node --transpile-only scripts/create-superadmin.ts
 *
 * Requerido: SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
 * Opcional: SUPERADMIN_FIRST_NAME, SUPERADMIN_LAST_NAME
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const email = process.env.SUPERADMIN_EMAIL;
const password = process.env.SUPERADMIN_PASSWORD;
const firstName = process.env.SUPERADMIN_FIRST_NAME ?? 'Super';
const lastName = process.env.SUPERADMIN_LAST_NAME ?? 'Admin';

if (!email || !password) {
  console.error('Define SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD');
  process.exit(1);
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === 'SUPER_ADMIN') {
      const passwordHash = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, status: 'ACTIVE', firstName, lastName },
      });
      console.log(`Usuario ya existía; contraseña y datos actualizados: ${email}`);
      return;
    }
    throw new Error(`El email ${email} ya está en uso con otro rol (${existing.role}).`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      firstName,
      lastName,
      companyId: null,
    },
  });
  console.log('Superadmin creado:', user.id, user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
