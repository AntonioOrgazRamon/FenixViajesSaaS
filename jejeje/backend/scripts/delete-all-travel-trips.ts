/**
 * Borra todos los viajes importados (travel_trips) y, por CASCADE, filas ligadas
 * (itinerario, servicios, hoteles, relación trip-destination, etc.).
 * No elimina documentos PDF ni la tabla destinations.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.travelTrip.deleteMany({});
  console.log(`OK: eliminados ${r.count} viaje(s) importado(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
