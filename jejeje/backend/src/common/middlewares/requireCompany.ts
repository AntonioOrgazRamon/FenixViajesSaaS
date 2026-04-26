import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors/AppError';

/** Solo usuarios con empresa (no SUPER_ADMIN sin contexto). Necesario para leads y recursos tenant-bound. */
export function requireCompanyMember(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new ForbiddenError('No autenticado'));
  }
  if (req.user.role === 'SUPER_ADMIN') {
    return next(new ForbiddenError('Los leads se gestionan desde el contexto de una empresa'));
  }
  if (!req.user.companyId) {
    return next(new ForbiddenError('Usuario sin empresa asignada'));
  }
  next();
}
