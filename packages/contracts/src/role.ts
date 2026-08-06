/**
 * Roles de plataforma. Espejo intencional de `enum Role` en
 * apps/api/prisma/schema.prisma: si cambia allí, debe cambiar aquí
 * (y viceversa) en el mismo cambio, no por separado.
 */
export const ROLE_VALUES = ['SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_USER'] as const;

export type Role = (typeof ROLE_VALUES)[number];
