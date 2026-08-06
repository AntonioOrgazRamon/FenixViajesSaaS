import { Request } from 'express';
import { ForbiddenError, ValidationError } from './errors/AppError';

/**
 * Paste/import-json: un COMPANY_ADMIN no puede declarar `companyId` de otra empresa en el body.
 */
export function assertPasteImportCompanyScope(req: Request, bodyCompanyId?: string): void {
  if (!req.user) return;
  const trimmed = typeof bodyCompanyId === 'string' ? bodyCompanyId.trim() : '';
  if (req.user.role === 'COMPANY_ADMIN' && trimmed && trimmed !== req.user.companyId) {
    throw new ValidationError('No puedes importar para otra empresa');
  }
}

/**
 * Contexto de empresa para recursos multi-tenant.
 * - COMPANY_ADMIN / COMPANY_USER: usan su companyId.
 * - SUPER_ADMIN: debe enviar `companyId` en query o body (nunca asumir una empresa).
 */
export function resolveTenantCompanyId(req: Request): string {
  if (!req.user) {
    throw new ForbiddenError('No autenticado');
  }
  if (req.user.role === 'COMPANY_ADMIN' || req.user.role === 'COMPANY_USER') {
    if (!req.user.companyId) {
      throw new ForbiddenError('Usuario sin empresa asignada');
    }
    return req.user.companyId;
  }
  if (req.user.role === 'SUPER_ADMIN') {
    const fromBody = (req.body as { companyId?: string } | undefined)?.companyId;
    const fromQuery = (req.query as { companyId?: string } | undefined)?.companyId;
    const id = (typeof fromBody === 'string' && fromBody) || (typeof fromQuery === 'string' && fromQuery);
    if (!id) {
      throw new ValidationError('Para SUPER_ADMIN se requiere companyId (query o body)');
    }
    return id;
  }
  throw new ForbiddenError('Rol no permitido');
}

/** Solo administración de catálogo: SUPER_ADMIN o COMPANY_ADMIN (no company users). */
export function assertCatalogAdmin(req: Request): void {
  if (!req.user) {
    throw new ForbiddenError('No autenticado');
  }
  if (req.user.role === 'COMPANY_USER') {
    throw new ForbiddenError('No tienes permisos para el catálogo (solo administradores)');
  }
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'COMPANY_ADMIN') {
    throw new ForbiddenError('Rol no permitido');
  }
}
