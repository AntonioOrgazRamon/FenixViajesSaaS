import { PanelCard } from '../../../components/ui/PanelCard';
import type { AuthUser, ProfilePreferencesClient } from '../../../store/authStore';
import { useUpdateProfileFields, humanizeProfileSaveError } from '../hooks/useUpdateProfileFields';
import { cn } from '../../../lib/cn';
import { sectionDescriptionClass, sectionTitleClass } from '../components/profileFormStyles';

const DEFAULT_PREFS: ProfilePreferencesClient = {
  notifyProduct: true,
  notifySecurity: true,
  notifyBilling: true,
  marketingOptIn: false,
};

const rows: { key: keyof ProfilePreferencesClient; title: string; hint: string }[] = [
  { key: 'notifyProduct', title: 'Producto y novedades', hint: 'Cambios relevantes en el panel, funcionalidades y mantenimientos programados.' },
  { key: 'notifySecurity', title: 'Seguridad e inicio de sesión', hint: 'Alertas de accesos, dispositivos o cambios sensibles en la cuenta (cuando estén activas vía email).' },
  { key: 'notifyBilling', title: 'Facturación y plan', hint: 'Avisos sobre el plan, facturación o renovaciones, si aplica a tu espacio de trabajo.' },
  { key: 'marketingOptIn', title: 'Contenido opcional', hint: 'Actualizaciones comerciales puntuales; se puede desactivar sin afectar avisos operativos reales.' },
];

function mergePrefs(data: AuthUser | undefined): ProfilePreferencesClient {
  if (!data?.profilePreferences) return { ...DEFAULT_PREFS };
  return { ...DEFAULT_PREFS, ...data.profilePreferences };
}

export function ProfileNotifications({ data }: { data: AuthUser }) {
  const mutation = useUpdateProfileFields();
  const prefs = mergePrefs(data);

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <h3 className={sectionTitleClass + ' !text-sm'}>Notificaciones por correo</h3>
        <p className={sectionDescriptionClass}>
          Ajusta qué tipo de mensajes quieres recibir. Los cambios se guardan al instante (cada interruptor, por
          separado). La entrega concreta depende de la plantilla y del proveedor de correo del despliegue.
        </p>
      </div>
      <PanelCard className="min-w-0" padding="p-3 sm:p-4">
        <ul className="space-y-2">
          {rows.map(({ key, title, hint }) => {
            const on = prefs[key];
            return (
              <li
                key={key}
                className="flex flex-col gap-2 border-b border-zinc-200/60 pb-3 last:border-0 last:pb-0 dark:border-white/[0.06]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">{title}</p>
                    <p className="text-[11px] leading-relaxed text-zinc-500">{hint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ profilePreferences: { [key]: !on } })}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                      on ? 'bg-amber-500' : 'bg-zinc-300 dark:bg-zinc-600',
                      mutation.isPending && 'opacity-50',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                        on ? 'left-5' : 'left-0.5',
                      )}
                    />
                    <span className="sr-only">{on ? 'Activado' : 'Desactivado'}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {mutation.isError && (
          <p className="mt-2 text-xs text-red-500" role="alert">
            {humanizeProfileSaveError(mutation.error)}
          </p>
        )}
      </PanelCard>
    </div>
  );
}
