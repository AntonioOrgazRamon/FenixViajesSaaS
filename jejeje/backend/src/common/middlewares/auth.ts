import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../errors/AppError';
import { config } from '../config';
import prisma from '../../infrastructure/db';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token no proporcionado');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string; sessionId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, status: true, companyId: true, company: { select: { status: true } } },
    });

    if (!user) throw new UnauthorizedError('Usuario no encontrado');
    if (user.status !== 'ACTIVE') throw new ForbiddenError(`Usuario en estado: ${user.status}`);
    
    if (user.companyId && user.company?.status !== 'ACTIVE') {
      throw new ForbiddenError(`Empresa en estado: ${user.company?.status}`);
    }

    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedError('Sesión inválida o revocada');
    }

    req.user = {
      id: user.id,
      role: user.role,
      companyId: user.companyId,
      sessionId: session.id,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Token inválido o expirado'));
    } else {
      next(error);
    }
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError('No tienes permisos para esta acción');
    }
    next();
  };
};
