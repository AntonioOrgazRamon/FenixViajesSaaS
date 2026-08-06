import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Globe,
  KeyRound,
  MonitorSmartphone,
  Shield,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import type { UserDetail, UserDetailAuditRow } from '../../../types/domain';
import { PanelCard } from '../../../components/ui/PanelCard';
import { cn } from '../../../lib/cn';
import { UserAvatarView, type UserAvatarUserFields } from '../../../lib/userAvatarView';
import { labelForAuditAction } from '../../profile/lib/profileActivityLabels';
import {
  formatDateTime,
  labelAuthProvider,
  labelCompanyStatus,
  labelRole,
  labelTheme,
  labelUserStatus,
} from '../../../lib/userDisplayLabels';

function detailToAvatarUser(d: UserDetail): UserAvatarUserFields {
  const shape =
    d.avatarShape === 'ROUNDED' ? 'rounded' : d.avatarShape === 'SQUARE' ? 'square' : 'circle';
  const type = d.avatarType === 'UPLOADED' ? 'uploaded' : 'default';
  return {
    email: d.email,
    firstName: d.firstName,
    lastName: d.lastName,
    avatar_url: d.avatarUrl,
    avatar: {
      type,
      url: d.avatarUrl,
      initials:
        d.avatarInitials?.trim() ||
        [d.firstName?.trim().charAt(0), d.lastName?.trim().charAt(0)]
          .filter(Boolean)
          .join('')
          .toUpperCase()
          .slice(0, 2) ||
        d.email.charAt(0).toUpperCase(),
      backgroundColor: d.avatarBackgroundColor ?? '#fffbeb',
      textColor: d.avatarTextColor ?? '#78350f',
      shape,
    },
  };
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
      {children}
    </h2>
  );
}

function Row({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4',
        className,
      )}
    >
      <dt className="shrink-0 text-[12px] text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd
        className={cn(
          'min-w-0 text-right text-[13px] text-zinc-900 dark:text-zinc-100 sm:text-left',
          mono && 'font-mono text-[12px] break-all',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function StatTile({
  label,
  value,
  to,
  hint,
}: {
  label: string;
  value: number;
  to?: string;
  hint?: string;
}) {
  const inner = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-500">{hint}</p> : null}
      {to ? (
        <span className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          Ver listado
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : null}
    </>
  );

  const className = cn(
    'rounded-xl border border-zinc-200/90 bg-white/60 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.02]',
    to && 'transition-colors hover:border-amber-300/60 hover:bg-amber-50/40 dark:hover:border-amber-500/25 dark:hover:bg-amber-500/[0.06]',
  );

  if (to) {
    return (
      <Link to={to} className={cn('block min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50', className)}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

function AuditResultBadge({ result }: { result: string }) {
  const ok = result === 'SUCCESS';
  return (
    <span
      className={cn(
        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        ok
          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
          : 'bg-red-500/15 text-red-800 dark:text-red-200',
      )}
    >
      {ok ? 'OK' : result}
    </span>
  );
}

type Props = {
  data: UserDetail;
  /** Enlace a ficha de empresa (solo superadmin) */
  showCompanyAdminLink?: boolean;
  /** Base de rutas de leads (p. ej. `/leads`) — solo usuarios de empresa */
  leadsListBasePath?: string;
  /** Sesiones del usuario, si el visor tiene permiso */
  sessionsHref?: string;
};

export function UserDetailPanel({ data, showCompanyAdminLink, leadsListBasePath, sessionsHref }: Props) {
  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim() || '—';
  const visibleName = data.displayName?.trim() || fullName;
  const avatarUser = detailToAvatarUser(data);

  const assignedLeadsTo =
    leadsListBasePath && data.companyId
      ? `${leadsListBasePath}?assigned_user_id=${encodeURIComponent(data.id)}`
      : undefined;
  const createdLeadsTo =
    leadsListBasePath && data.companyId
      ? `${leadsListBasePath}?created_by_user_id=${encodeURIComponent(data.id)}`
      : undefined;

  const leadDetailHref = (leadId: string) =>
    leadsListBasePath ? `${leadsListBasePath.replace(/\/$/, '')}/${leadId}` : null;
  const recentAuditRows = data.recentAudit.slice(0, 6);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-gradient-to-br from-zinc-50/90 via-white to-amber-50/40 p-4 shadow-sm dark:border-white/[0.08] dark:from-zinc-900/40 dark:via-zinc-950 dark:to-amber-950/20 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <UserAvatarView user={avatarUser} size="profile" className="!h-[4.5rem] !w-[4.5rem] !min-h-[4.5rem] !min-w-[4.5rem] text-xl shadow-sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white">{data.email}</h1>
              <span className="rounded-full bg-zinc-200/80 px-2.5 py-0.5 text-[11px] font-medium text-zinc-800 dark:bg-white/10 dark:text-zinc-200">
                {labelRole(data.role)}
              </span>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-400/20 dark:text-amber-100">
                {labelUserStatus(data.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{visibleName}</p>
            <p className="mt-1 font-mono text-[11px] text-zinc-400 dark:text-zinc-500" title="ID interno">
              {data.id}
            </p>
            {(sessionsHref || assignedLeadsTo || createdLeadsTo) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {sessionsHref ? (
                  <Link
                    to={sessionsHref}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                  >
                    <MonitorSmartphone className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                    Sesiones
                  </Link>
                ) : null}
                {assignedLeadsTo ? (
                  <Link
                    to={assignedLeadsTo}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                  >
                    <Users className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                    Leads asignados
                  </Link>
                ) : null}
                {createdLeadsTo ? (
                  <Link
                    to={createdLeadsTo}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-white/15 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                    Leads creados
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {data.companyId ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <StatTile
              label="Leads asignados"
              value={data.leadsAssignedCount}
              to={assignedLeadsTo}
              hint="Como responsable"
            />
            <StatTile
              label="Leads creados"
              value={data.leadsCreatedCount}
              to={createdLeadsTo}
              hint="Alta manual u orígenes internos"
            />
            <StatTile label="Sesiones activas" value={data.activeSessionCount} hint="Tokens válidos ahora" />
          </div>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-1">
            <StatTile label="Sesiones activas" value={data.activeSessionCount} hint="Tokens válidos ahora" />
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        <PanelCard padding="p-3.5" className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
            <User className="h-4 w-4 text-amber-600/80 dark:text-amber-400/80" strokeWidth={1.75} aria-hidden />
            <SectionTitle>Identidad</SectionTitle>
          </div>
          <dl className="space-y-2 border-t border-zinc-200/80 pt-2.5 dark:border-white/[0.08]">
            <Row label="Nombre completo" value={fullName} />
            {data.displayName ? <Row label="Nombre para mostrar" value={data.displayName} /> : null}
            <Row label="Teléfono" value={data.phone || '—'} />
          </dl>
        </PanelCard>

        <PanelCard padding="p-3.5" className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
            <Shield className="h-4 w-4 text-amber-600/80 dark:text-amber-400/80" strokeWidth={1.75} aria-hidden />
            <SectionTitle>Cuenta y acceso</SectionTitle>
          </div>
          <dl className="space-y-2 border-t border-zinc-200/80 pt-2.5 dark:border-white/[0.08]">
            <Row label="Inicio de sesión" value={labelAuthProvider(data.authProvider)} />
            {data.theme ? <Row label="Tema" value={labelTheme(data.theme)} /> : null}
            <Row label="Idioma (locale)" value={data.locale || '—'} />
            <Row label="Zona horaria" value={data.timezone || '—'} />
            {(() => {
              const f = [data.dateFormat, data.timeFormat].filter(Boolean).join(' · ');
              return f ? <Row label="Formato fecha/hora" value={f} mono /> : null;
            })()}
          </dl>
        </PanelCard>

        <PanelCard padding="p-3.5" className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
            <MonitorSmartphone className="h-4 w-4 text-amber-600/80 dark:text-amber-400/80" strokeWidth={1.75} aria-hidden />
            <SectionTitle>Actividad</SectionTitle>
          </div>
          <dl className="space-y-2 border-t border-zinc-200/80 pt-2.5 dark:border-white/[0.08]">
            <Row label="Último inicio de sesión" value={formatDateTime(data.lastLoginAt, 'Nunca registrado')} />
            <Row label="Alta en el sistema" value={formatDateTime(data.createdAt)} />
            <Row label="Última actualización" value={formatDateTime(data.updatedAt)} />
          </dl>
        </PanelCard>

        <PanelCard padding="p-3.5" className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
            <KeyRound className="h-4 w-4 text-amber-600/80 dark:text-amber-400/80" strokeWidth={1.75} aria-hidden />
            <SectionTitle>Seguridad</SectionTitle>
          </div>
          <dl className="space-y-2 border-t border-zinc-200/80 pt-2.5 dark:border-white/[0.08]">
            <Row
              label="Último cambio de contraseña"
              value={formatDateTime(data.lastPasswordChangeAt, 'Sin registro')}
            />
            <Row
              label="Cuenta bloqueada"
              value={
                data.lockedUntil ? (
                  <span className="text-amber-800 dark:text-amber-200">Hasta {formatDateTime(data.lockedUntil)}</span>
                ) : (
                  'No'
                )
              }
            />
            <Row label="Intentos fallidos (acumulado)" value={String(data.failedLoginAttempts)} />
          </dl>
        </PanelCard>

        {data.companyId ? (
          <PanelCard padding="p-3.5" className="min-w-0 xl:col-span-2">
            <div className="mb-3 flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
              <Building2 className="h-4 w-4 text-amber-600/80 dark:text-amber-400/80" strokeWidth={1.75} aria-hidden />
              <SectionTitle>Organización</SectionTitle>
            </div>
            <dl className="space-y-2 border-t border-zinc-200/80 pt-2.5 dark:border-white/[0.08]">
              {data.company ? (
                <>
                  <Row label="Empresa" value={data.company.name} />
                  <Row label="Slug" value={data.company.slug} mono />
                  <Row label="Estado de la empresa" value={labelCompanyStatus(data.company.status)} />
                </>
              ) : (
                <Row label="ID de empresa" value={data.companyId} mono />
              )}
            </dl>
            {showCompanyAdminLink && data.company?.id ? (
              <div className="mt-3 border-t border-zinc-200/80 pt-3 dark:border-white/[0.08]">
                <Link
                  to={`/superadmin/tenants/${data.company.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
                >
                  Ver ficha de empresa
                  <Globe className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            ) : null}
          </PanelCard>
        ) : (
          <PanelCard padding="p-3.5" className="min-w-0 border-dashed xl:col-span-2">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <Building2 className="h-4 w-4" aria-hidden />
              <p className="text-sm">Sin empresa asignada (p. ej. super admin o usuario sin espacio).</p>
            </div>
          </PanelCard>
        )}

        <PanelCard padding="p-3.5" className="min-w-0 lg:col-span-2 xl:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
            <Activity className="h-4 w-4 text-amber-600/80 dark:text-amber-400/80" strokeWidth={1.75} aria-hidden />
            <SectionTitle>Actividad reciente</SectionTitle>
          </div>
          {recentAuditRows.length === 0 ? (
            <p className="border-t border-zinc-200/80 pt-3 text-sm text-zinc-500 dark:border-white/[0.08]">
              No hay eventos recientes de auditoría para este usuario.
            </p>
          ) : (
            <ul className="space-y-0 border-t border-zinc-200/80 dark:border-white/[0.08]">
              {recentAuditRows.map((row: UserDetailAuditRow, idx: number) => {
                const leadHref =
                  row.targetType === 'LEAD' && row.targetId ? leadDetailHref(row.targetId) : null;
                const content = (
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {labelForAuditAction(row.action)}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-500">
                      {formatDateTime(row.createdAt)}
                    </span>
                  </div>
                );
                return (
                  <li
                    key={row.id}
                    className={cn(
                      'flex gap-2.5 py-2',
                      idx < recentAuditRows.length - 1 && 'border-b border-zinc-200/60 dark:border-white/[0.06]',
                    )}
                  >
                    <AuditResultBadge result={row.result} />
                    {leadHref ? (
                      <Link
                        to={leadHref}
                        className="flex min-w-0 flex-1 items-start gap-1 rounded-lg outline-none ring-amber-500/0 transition-shadow hover:bg-zinc-50/80 focus-visible:ring-2 dark:hover:bg-white/[0.04]"
                      >
                        {content}
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                      </Link>
                    ) : (
                      <div className="min-w-0 flex-1">{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </PanelCard>
      </div>

      {data.recentAudit.length > recentAuditRows.length ? (
        <p className="text-xs text-zinc-500">Mostrando las 6 acciones más recientes.</p>
      ) : null}

      <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Calendar className="h-3.5 w-3.5" aria-hidden />
        <Clock className="h-3.5 w-3.5" aria-hidden />
        Fechas en hora local del navegador.
      </p>
    </div>
  );
}
