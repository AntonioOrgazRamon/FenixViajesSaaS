/**
 * Seed mínimo local: 3 TravelTrip APPROVED + 1 Lead con contexto rico (sin PDF).
 * Uso: npx ts-node --transpile-only scripts/seed-e2e-travel-and-lead.ts [companySlug]
 *
 * Idempotencia aproximada: si ya hay ≥3 APPROVED para el tenant, solo crea lead si no hay ninguno.
 */
import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../src/infrastructure/db';

async function main() {
  const slug = process.argv[2];
  const company = await prisma.company.findFirst({
    where: { status: 'ACTIVE', deletedAt: null, ...(slug ? { slug } : {}) },
  });
  if (!company) {
    console.error('Empresa no encontrada.');
    process.exit(1);
  }
  const { id: companyId } = company;

  const n = await prisma.travelTrip.count({ where: { companyId, status: 'APPROVED' } });
  if (n < 3) {
    const trips = [
      {
        title: 'Vietnam esencial 10 días',
        mainDestination: 'Vietnam',
        durationDays: 10,
        price: 1899,
        desc: 'Circuito cultural. Naturaleza Ha Long. Presupuesto ajustado.',
      },
      {
        title: 'Vietnam recomendado 12 días',
        mainDestination: 'Vietnam · Hanói',
        durationDays: 12,
        price: 2650,
        desc: 'Equilibrio calidad-precio. Preferencias: vuelos directos, hoteles boutique.',
      },
      {
        title: 'Vietnam boutique premium 14 días',
        mainDestination: 'Vietnam',
        durationDays: 14,
        price: 3890,
        desc: 'Experiencia completa. Muchos días de itinerario detallado. Servicios incluidos premium.',
      },
    ];
    for (const t of trips) {
      await prisma.travelTrip.create({
        data: {
          id: uuidv4(),
          companyId,
          title: t.title,
          mainDestination: t.mainDestination,
          durationDays: t.durationDays,
          indicativePrice: new Prisma.Decimal(t.price),
          currency: 'EUR',
          status: 'APPROVED',
          description: t.desc,
          season: 'Salidas marzo 2026',
        },
      });
    }
    console.log(`Creados ${trips.length} viajes APPROVED para ${company.slug}.`);
  } else {
    console.log(`Ya hay ${n} viajes APPROVED; no se crean viajes nuevos.`);
  }

  const existingLead = await prisma.lead.findFirst({
    where: { companyId, deletedAt: null, message: { contains: 'E2E Vietnam' } },
  });
  if (existingLead) {
    console.log('Lead E2E ya existe:', existingLead.id);
    await prisma.$disconnect();
    return;
  }

  const leadId = uuidv4();
  const message = `E2E Vietnam: familia 2 adultos, marzo 2026, 12 días, presupuesto 2800€ por persona. Preferencias: vuelos directos, hoteles boutique, poco ritmo.`;

  await prisma.$transaction(async (tx) => {
    await tx.lead.create({
      data: {
        id: leadId,
        companyId,
        source: 'MANUAL',
        sourceDetail: 'seed-e2e',
        status: 'NEW',
        firstName: 'Prueba',
        lastName: 'E2E',
        fullName: 'Prueba E2E',
        email: `e2e+${Date.now()}@example.test`,
        phone: '+34 600 000 000',
        message,
        normalizedPayload: {
          travel: {
            destination: 'Vietnam',
            travelDate: '2026-03-15T00:00:00.000Z',
            seats: 2,
            durationDays: 12,
            budgetPerPerson: 2800,
            month: 3,
            preferences: ['vuelos directos', 'hoteles boutique', 'ritmo suave'],
            travelType: 'cultural',
          },
        } as Prisma.InputJsonValue,
      },
    });

    await tx.leadDetail.create({
      data: {
        id: uuidv4(),
        leadId,
        companyId,
        currentContext: {
          destination: 'Vietnam',
          travelDate: '2026-03-15',
          seats: 2,
          durationDays: 12,
          budgetPerPerson: 2800,
          preferences: 'vuelos directos; hoteles boutique',
        } as Prisma.InputJsonValue,
        travelContext: {
          destination: 'Vietnam',
          travelDate: '2026-03-15T00:00:00.000Z',
          seats: 2,
          durationDays: 12,
          budgetPerPerson: 2800,
          month: 3,
          travelType: 'cultural',
          tags: ['familia', 'slow'],
          preferences: ['vuelos directos', 'hoteles boutique'],
        } as Prisma.InputJsonValue,
      },
    });

    await tx.leadActivity.create({
      data: {
        companyId,
        leadId,
        actorType: 'SYSTEM',
        activityType: 'CREATED',
        title: 'Lead seed E2E',
        description: 'Datos sintéticos para pruebas locales.',
      },
    });
  });

  console.log('Lead E2E creado:', leadId);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
