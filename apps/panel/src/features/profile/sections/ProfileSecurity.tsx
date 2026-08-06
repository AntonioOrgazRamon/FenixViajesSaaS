import { Lock, Mail } from 'lucide-react';
import { PanelCard } from '../../../components/ui/PanelCard';
import { EmailChangeCard } from '../components/EmailChangeCard';
import { SecuritySummaryCard } from '../components/SecuritySummaryCard';
import { ProfileDangerZoneCard } from '../components/ProfileDangerZoneCard';
import type { AuthUser } from '../../../store/authStore';
import { formatDateTime } from '../lib/accountLabels';
import { cn } from '../../../lib/cn';

const detailsBase = cn(
  'group overflow-hidden rounded-lg border border-zinc-200/80 bg-zinc-50/30 dark:border-white/[0.08] dark:bg-zinc-950/20',
  '[&_summary::-webkit-details-marker]:hidden',
);

const summaryBase = cn(
  'flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] font-medium',
  'text-zinc-800 transition hover:bg-zinc-100/60 dark:text-zinc-200 dark:hover:bg-white/[0.04]',
  'select-none',
);

export function ProfileSecurity({ data }: { data: AuthUser }) {
  const lang = data.language === 'en' ? 'en' : 'es';

  return (
    <div className="flex min-w-0 flex-col gap-2.5 overflow-x-hidden sm:gap-3">
      <PanelCard className="min-w-0 max-w-full overflow-hidden" padding="p-2.5 sm:p-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Resumen</p>
        <div className="mt-2 flex min-w-0 flex-wrap items-stretch gap-1.5 sm:gap-2">
          <div
            className="flex min-h-[2.75rem] min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-zinc-200/80 bg-white/50 px-2.5 py-1.5 dark:border-white/[0.08] dark:bg-zinc-900/30 sm:min-w-0 sm:flex-1"
            title="Doble factor (TOTP) en roadmap"
          >
            <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-500">
              <Lock className="h-3 w-3 shrink-0" aria-hidden />
              2FA
            </span>
            <span className="text-[9px] font-semibold text-zinc-500">Próx.</span>
          </div>
          <div className="flex min-h-[2.75rem] min-w-0 flex-1 flex-col justify-center rounded-md border border-zinc-200/80 bg-white/50 px-2.5 py-1.5 dark:border-white/[0.08] dark:bg-zinc-900/30 sm:min-w-0 sm:flex-1">
            <span className="text-[9px] font-medium uppercase tracking-wide text-zinc-500">Última clave</span>
            <span className="truncate text-[11px] font-medium tabular-nums text-zinc-900 dark:text-zinc-100" title={data.lastPasswordChangeAt ?? undefined}>
              {formatDateTime(data.lastPasswordChangeAt ?? null, lang)}
            </span>
          </div>
        </div>

        <div className="mt-3">
          <SecuritySummaryCard embedded compact inlineLinks />
        </div>
      </PanelCard>

      <details className={detailsBase}>
        <summary className={summaryBase}>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-500" strokeWidth={2} aria-hidden />
            <span className="truncate">Correo de inicio de sesión</span>
          </span>
          <span className="shrink-0 text-[10px] text-zinc-400 group-open:hidden">Expandir</span>
          <span className="hidden shrink-0 text-[10px] text-zinc-400 group-open:inline">Ocultar</span>
        </summary>
        <div className="border-t border-zinc-200/70 px-3 pb-3 pt-2 dark:border-white/[0.06]">
          <p className="mb-2 text-[10px] leading-snug text-zinc-500">Pide la contraseña actual para asociar un nuevo email.</p>
          <EmailChangeCard currentEmail={data.email} embedded compact />
        </div>
      </details>

      <details className={detailsBase}>
        <summary className={summaryBase}>
          <span className="min-w-0 text-zinc-700 dark:text-zinc-300">Baja, datos y portabilidad</span>
          <span className="shrink-0 text-[10px] text-zinc-400 group-open:hidden">Expandir</span>
          <span className="hidden shrink-0 text-[10px] text-zinc-400 group-open:inline">Ocultar</span>
        </summary>
        <div className="border-t border-zinc-200/70 px-3 pb-3 pt-2 dark:border-white/[0.06]">
          <ProfileDangerZoneCard embedded compact />
        </div>
      </details>
    </div>
  );
}
