import prisma from '../../infrastructure/db';
import bcrypt from 'bcrypt';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/AppError';

export class CompanyService {
  async create(data: any, actorUserId: string) {
    const { company, initialAdmin } = data;

    const existingCompany = await prisma.company.findUnique({ where: { slug: company.slug } });
    if (existingCompany) throw new ConflictError('COMPANY_SLUG_ALREADY_EXISTS');

    const existingUser = await prisma.user.findUnique({ where: { email: initialAdmin.email } });
    if (existingUser) throw new ConflictError('EMAIL_ALREADY_EXISTS');

    const passwordHash = await bcrypt.hash(initialAdmin.password, 10);

    // Transacción para crear empresa y su primer admin
    const result = await prisma.$transaction(async (tx) => {
      const newCompany = await tx.company.create({
        data: {
          name: company.name,
          slug: company.slug,
          createdBy: actorUserId,
        }
      });

      const newAdmin = await tx.user.create({
        data: {
          companyId: newCompany.id,
          email: initialAdmin.email,
          passwordHash,
          role: 'COMPANY_ADMIN',
          firstName: initialAdmin.firstName,
          lastName: initialAdmin.lastName,
          phone: initialAdmin.phone,
        }
      });

      await tx.auditLog.create({
        data: {
          actorUserId,
          actorRole: 'SUPER_ADMIN',
          companyId: newCompany.id,
          action: 'COMPANY_CREATED',
          targetType: 'COMPANY',
          targetId: newCompany.id,
          result: 'SUCCESS'
        }
      });

      return { company: newCompany, initialAdmin: { id: newAdmin.id, email: newAdmin.email } };
    });

    return result;
  }

  async findAll(page = 1, pageSize = 10) {
    const skip = (page - 1) * pageSize;
    const [total, data] = await Promise.all([
      prisma.company.count(),
      prisma.company.findMany({ skip, take: pageSize, orderBy: { createdAt: 'desc' } })
    ]);

    return { total, page, pageSize, data };
  }

  async findById(id: string) {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundError('COMPANY_NOT_FOUND');
    return company;
  }

  async update(id: string, data: any, actorUserId: string) {
    const company = await this.findById(id);
    
    if (data.slug && data.slug !== company.slug) {
      const existing = await prisma.company.findUnique({ where: { slug: data.slug } });
      if (existing) throw new ConflictError('COMPANY_SLUG_ALREADY_EXISTS');
    }

    const updated = await prisma.company.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        actorUserId,
        actorRole: 'SUPER_ADMIN',
        companyId: id,
        action: 'COMPANY_UPDATED',
        targetType: 'COMPANY',
        targetId: id,
        result: 'SUCCESS'
      }
    });

    return updated;
  }

  async suspend(id: string, reason: string | undefined, actorUserId: string) {
    const company = await this.findById(id);
    if (company.status === 'DELETED') throw new ConflictError('COMPANY_DELETED');
    if (company.status === 'SUSPENDED') throw new ConflictError('COMPANY_ALREADY_SUSPENDED');

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: { status: 'SUSPENDED', suspendedAt: new Date() }
      });

      // Revocar todas las sesiones de los usuarios de esta empresa
      await tx.session.updateMany({
        where: { companyId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'COMPANY_SUSPENDED' }
      });

      await tx.auditLog.create({
        data: { actorUserId, actorRole: 'SUPER_ADMIN', companyId: id, action: 'COMPANY_SUSPENDED', targetType: 'COMPANY', targetId: id, reason, result: 'SUCCESS' }
      });
    });

    return { status: 'SUSPENDED' };
  }

  async reactivate(id: string, reason: string | undefined, actorUserId: string) {
    const company = await this.findById(id);
    if (company.status !== 'SUSPENDED') throw new ConflictError('INVALID_COMPANY_STATE');

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: { status: 'ACTIVE', suspendedAt: null }
      });

      await tx.auditLog.create({
        data: { actorUserId, actorRole: 'SUPER_ADMIN', companyId: id, action: 'COMPANY_REACTIVATED', targetType: 'COMPANY', targetId: id, reason, result: 'SUCCESS' }
      });
    });

    return { status: 'ACTIVE' };
  }

  async delete(id: string, reason: string | undefined, actorUserId: string) {
    const company = await this.findById(id);
    if (company.status === 'DELETED') throw new ConflictError('COMPANY_ALREADY_DELETED');

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id },
        data: { status: 'DELETED', deletedAt: new Date() }
      });

      await tx.session.updateMany({
        where: { companyId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'COMPANY_DELETED' }
      });

      await tx.auditLog.create({
        data: { actorUserId, actorRole: 'SUPER_ADMIN', companyId: id, action: 'COMPANY_DELETED_SOFT', targetType: 'COMPANY', targetId: id, reason, result: 'SUCCESS' }
      });
    });

    return { status: 'DELETED' };
  }
}
