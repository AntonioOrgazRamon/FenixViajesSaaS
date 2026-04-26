import { Building2, Headphones, Users } from 'lucide-react';
import { PanelCard } from '../../../components/ui/PanelCard';
import type { AuthUser } from '../../../store/authStore';
import { companyStatusLabel, roleLabel } from '../lib/accountLabels';
import { sectionDescriptionClass, sectionTitleClass } from '../components/profileFormStyles';
import { supportMailto } from '../lib/accountLinks';
import { cn } from '../../../lib/cn';

export function ProfileOrganization({ data }: { data: AuthUser }) {
  const hasCo = !!data.company;

  return (
    <div className="min-w-0 space-y-4">
      <PanelCard className="min-w-0" padding="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
              'border-zinc-200/90 bg-zinc-50/80 text-amber-700 dark:border-white/10 dark:bg-zinc-900/50 dark:text-amber-300',
            )}
          >
            <Building2 className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className={sectionTitleClass + ' !text-sm'}>Tu organización</h3>
            <p className={sectionDescriptionClass}>
              {hasCo
                ? 'Pertenencia y estado del espacio de trabajo donde operas en la plataforma.'
                : 'Operas en el entorno de plataforma (sin espacio de empresa vinculado a esta sesión).'}
            </p>
            <dl className="mt-3 space-y-1.5 text-[13px]">
              <div>
                <dt className="text-zinc-500">Nombre</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                  {hasCo ? data.company!.name : 'NakedCode (plataforma)'}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Estado</dt>
                <dd className="text-zinc-800 dark:text-zinc-200">
                  {hasCo ? companyStatusLabel(data.company!.status) : '—'}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                <span className="text-zinc-500">Tu rol</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{roleLabel(data.role)}</span>
              </div>
            </dl>
          </div>
        </div>
      </PanelCard>

      <PanelCard className="min-w-0" padding="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Headphones className="h-4 w-4 shrink-0 text-amber-600/90 dark:text-amber-400/90" aria-hidden />
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Soporte y contacto</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Para incidencias de acceso, facturación o datos personales, escribe a tu administrador o a soporte
              indicando el correo de la cuenta y la organización.
            </p>
            <a
              className="mt-2 inline-flex text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"
              href={`mailto:${supportMailto}?subject=Soporte%20cuenta%20NakedCode`}
            >
              {supportMailto}
            </a>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}
