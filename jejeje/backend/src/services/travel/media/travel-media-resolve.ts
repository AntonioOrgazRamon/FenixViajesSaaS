import prisma from '../../../infrastructure/db';

/** Solo lectura BD: propuestas y smart-proposal no llaman a Unsplash/Pexels. */
export async function getPrimaryHeroImageByTripIds(
  companyId: string,
  tripIds: string[],
): Promise<Map<string, string>> {
  if (!tripIds.length) return new Map();
  try {
    const rows = await prisma.travelMediaAsset.findMany({
      where: { companyId, tripId: { in: tripIds }, isPrimary: true },
      select: { tripId: true, imageUrl: true },
    });
    return new Map(rows.map((r) => [r.tripId, r.imageUrl]));
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
    if (code === 'P2021') return new Map();
    throw e;
  }
}
