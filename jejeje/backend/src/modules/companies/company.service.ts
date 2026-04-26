import { Prisma, CompanyStatus } from '@prisma/client';
import prisma from '../../infrastructure/db';
import bcrypt from 'bcrypt';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/AppError';

const companyStatusValues = new Set<CompanyStatus>(Object.values(CompanyStatus));

function parseStatus(s: string | undefined): CompanyStatus | undefined {
  if (!s || !s.trim()) return undefined;
  const u = s.trim() as CompanyStatus;
  return companyStatusValues.has(u) ? u : undefined;
}

export class CompanyService {
  async create(data: any, actorUserId: string) {
    const { company, initialAdmin } = data;

    const existingCompany = await prisma.company.findUnique({ where: { slug: company.slug } });
    if (existingCompany) throw new ConflictError('COMPANY_SLUG_ALREADY_EXISTS');

    const existingUser = await prisma.user.findUnique({ where: { email: initialAdmin.email }, select: { id: true } });
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

  async findAll(
    page = 1,
    pageSize = 10,
    filters: {
      q?: string;
      status?: string;
      leadsMin?: number;
      leadsMax?: number;
      usersMin?: number;
      usersMax?: number;
    } = {},
  ) {
    const take = Math.min(100, Math.max(1, pageSize));
    const p = Math.max(1, page);
    const skip = (p - 1) * take;

    const { q, status: stIn, leadsMin, leadsMax, usersMin, usersMax } = filters;
    const st = parseStatus(stIn);
    const t = (q || '').trim();

    const whereParts: Prisma.Sql[] = [];
    if (st) {
      whereParts.push(Prisma.sql`c.status = ${st}`);
    }
    if (t) {
      const like = `%${t}%`;
      whereParts.push(Prisma.sql`(c.name LIKE ${like} OR c.slug LIKE ${like})`);
    }
    if (leadsMin != null) {
      whereParts.push(Prisma.sql`(SELECT COUNT(*) FROM \`leads\` l WHERE l.company_id = c.id) >= ${leadsMin}`);
    }
    if (leadsMax != null) {
      whereParts.push(Prisma.sql`(SELECT COUNT(*) FROM \`leads\` l WHERE l.company_id = c.id) <= ${leadsMax}`);
    }
    if (usersMin != null) {
      whereParts.push(Prisma.sql`(SELECT COUNT(*) FROM \`users\` u WHERE u.company_id = c.id) >= ${usersMin}`);
    }
    if (usersMax != null) {
      whereParts.push(Prisma.sql`(SELECT COUNT(*) FROM \`users\` u WHERE u.company_id = c.id) <= ${usersMax}`);
    }

    const whereSql = whereParts.length > 0 ? Prisma.join(whereParts, ' AND ') : Prisma.sql`1=1`;

    type CRow = {
      id: string;
      name: string;
      slug: string;
      status: string;
      created_at: Date;
      updated_at: Date;
      lead_cnt: bigint;
      user_cnt: bigint;
    };

    const [countRows, listRows] = await Promise.all([
      prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`SELECT COUNT(*) as c FROM \`companies\` c WHERE ${whereSql}`),
      prisma.$queryRaw<CRow[]>(Prisma.sql`
        SELECT c.id, c.name, c.slug, c.status, c.created_at, c.updated_at,
          (SELECT COUNT(*) FROM \`leads\` l WHERE l.company_id = c.id) AS lead_cnt,
          (SELECT COUNT(*) FROM \`users\` u WHERE u.company_id = c.id) AS user_cnt
        FROM \`companies\` c
        WHERE ${whereSql}
        ORDER BY c.created_at DESC
        LIMIT ${take} OFFSET ${skip}
      `),
    ]);

    const total = Number(countRows[0]?.c ?? 0);
    const data = listRows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      leadsCount: Number(c.lead_cnt),
      usersCount: Number(c.user_cnt),
    }));

    return { total, page: p, pageSize: take, data };
  }

  async findById(id: string) {
    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        suspendedAt: true,
        deletedAt: true,
      },
    });
    if (!company) throw new NotFoundError('COMPANY_NOT_FOUND');

    const [usersCount, leadsCount, activeSessionCount, lastUserCreatedAt, lastLeadCreatedAt, recentAudit] =
      await Promise.all([
        prisma.user.count({ where: { companyId: id, status: { not: 'DELETED' } } }),
        prisma.lead.count({ where: { companyId: id, deletedAt: null } }),
        prisma.session.count({
          where: { companyId: id, revokedAt: null, expiresAt: { gt: new Date() } },
        }),
        prisma.user.findFirst({
          where: { companyId: id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        prisma.lead.findFirst({
          where: { companyId: id, deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        prisma.auditLog.findMany({
          where: { OR: [{ companyId: id }, { targetCompanyId: id }] },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            action: true,
            result: true,
            createdAt: true,
            targetType: true,
            targetId: true,
            actorRole: true,
          },
        }),
      ]);

    return {
      ...company,
      usersCount,
      leadsCount,
      activeSessionCount,
      lastUserCreatedAt: lastUserCreatedAt?.createdAt.toISOString() ?? null,
      lastLeadCreatedAt: lastLeadCreatedAt?.createdAt.toISOString() ?? null,
      recentAudit: recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        result: a.result,
        createdAt: a.createdAt.toISOString(),
        targetType: a.targetType,
        targetId: a.targetId,
        actorRole: a.actorRole,
      })),
    };
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
