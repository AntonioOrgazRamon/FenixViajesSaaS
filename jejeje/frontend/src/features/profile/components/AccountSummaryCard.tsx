import { UserAvatarView } from '../../../lib/userAvatarView';
import { PanelCard } from '../../../components/ui/PanelCard';
import type { AuthUser } from '../../../store/authStore';
import { accountStatusLabel, companyStatusLabel, formatDateTime, roleLabel } from '../lib/accountLabels';
import { StatusBadge } from './StatusBadge';
import { sectionDescriptionClass, sectionTitleClass } from './profileFormStyles';

export function AccountSummaryCard({ user }: { user: AuthUser }) {
  const lang = user.language ?? 'es';
  const display =
    user.displayName?.trim() || [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

  const statusTone: 'success' | 'warn' | 'danger' =
    user.accountStatus === 'ACTIVE' || !user.accountStatus ? 'success' : 'warn';

  return (
    <section aria-labelledby="account-summary-title" className="min-w-0">
      <PanelCard className="min-w-0" padding="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
          <div className="shrink-0">
            <UserAvatarView user={user} size="profile" className="h-20 w-20 min-h-20 min-w-20 text-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="account-summary-title" className={sectionTitleClass}>
              Resumen de la cuenta
            </h2>
            <p className={sectionDescriptionClass}>
              Identidad, pertenencia y acceso. Los cambios concretos de datos se guardan en cada bloque inferior.
            </p>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white" title={display}>
              {display}
            </p>
            <p className="truncate text-xs text-zinc-500" title={user.email}>
              {user.email}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge tone="neutral">{roleLabel(user.role)}</StatusBadge>
              <StatusBadge tone={statusTone}>{accountStatusLabel(user.accountStatus)}</StatusBadge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <StatusBadge tone="success">Correo verificado</StatusBadge>
              <StatusBadge tone="warn">2FA · próximamente</StatusBadge>
              <StatusBadge tone={user.has_google_linked ? 'success' : 'neutral'}>
                {user.has_google_linked ? 'Google vinculado' : 'Google no vinculado'}
              </StatusBadge>
            </div>
          </div>
        </div>
        <dl className="mt-4 grid gap-2 border-t border-zinc-200/80 pt-3 text-[12px] dark:border-white/[0.06] sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Empresa</dt>
            <dd className="text-zinc-800 dark:text-zinc-200">
              {user.company
                ? `${user.company.name} · ${companyStatusLabel(user.company.status)}`
                : '— (plataforma)'}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Último acceso</dt>
            <dd className="text-zinc-800 dark:text-zinc-200 tabular-nums">
              {formatDateTime(user.lastLoginAt, lang)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Cuenta creada</dt>
            <dd className="text-zinc-800 dark:text-zinc-200 tabular-nums">
              {formatDateTime(user.createdAt, lang)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Último cambio de contraseña</dt>
            <dd className="text-zinc-800 dark:text-zinc-200 tabular-nums">
              {formatDateTime(user.lastPasswordChangeAt, lang)}
            </dd>
          </div>
        </dl>
      </PanelCard>
    </section>
  );
}
