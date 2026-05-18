/**
 * Lista empresas (id + nombre) para elegir companyId de prueba.
 * Uso: npx ts-node --transpile-only scripts/geo-list-companies.ts
 */
import 'dotenv/config';
import prisma from '../src/infrastructure/db';

async function main() {
  const rows = await prisma.company.findMany({
    select: { id: true, name: true, slug: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(JSON.stringify(rows, null, 2));
}

void main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
