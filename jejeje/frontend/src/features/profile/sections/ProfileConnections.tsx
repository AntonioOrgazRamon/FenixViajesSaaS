import { useState } from 'react';
import { Link2, Unlink } from 'lucide-react';
import { PanelCard } from '../../../components/ui/PanelCard';
import { api } from '../../../lib/axios';
import { getApiErrorMessage } from '../../../lib/errors';
import type { AuthUser } from '../../../store/authStore';
import { sectionDescriptionClass, sectionTitleClass } from '../components/profileFormStyles';
import { cn } from '../../../lib/cn';

export function ProfileConnections({ data }: { data: AuthUser }) {
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const linked = !!data.has_google_linked;

  const run = async (path: 'link-google' | 'unlink-google') => {
    setErr(null);
    setLoading(true);
    try {
      await api.post(`/profile/${path}`);
    } catch (e) {
      setErr(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <h3 className={sectionTitleClass + ' !text-sm'}>Conexiones e inicio de sesión</h3>
        <p className={sectionDescriptionClass}>
          Vincular Google u otros proveedores reduce fricción al entrar. La integración completa depende de la
          configuración del despliegue.
        </p>
      </div>
      <PanelCard className="min-w-0" padding="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">Google</p>
            <p className="text-[11px] text-zinc-500">
              Estado:{' '}
              <span className={cn('font-medium', linked ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-600')}>
                {linked ? 'Cuenta vinculada' : 'No vinculada'}
              </span>
            </p>
            <p className="mt-1 text-[10px] text-zinc-500">Proveedor de autenticación: {data.auth_provider ?? 'LOCAL'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading || linked}
              onClick={() => run('link-google')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-200 dark:hover:bg-zinc-800/50"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Vincular Google
            </button>
            <button
              type="button"
              disabled={loading || !linked}
              onClick={() => run('unlink-google')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200/80 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5"
            >
              <Unlink className="h-3.5 w-3.5" aria-hidden />
              Desvincular
            </button>
          </div>
        </div>
        {err && (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200" role="status">
            {err}
          </p>
        )}
      </PanelCard>
    </div>
  );
}
