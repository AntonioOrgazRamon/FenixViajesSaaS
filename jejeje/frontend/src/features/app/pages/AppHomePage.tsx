import { useAuthStore } from '../../../store/authStore';
import { Link } from 'react-router-dom';
import { Radar, Sparkles, Target, UserCircle } from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';

export function AppHomePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title={user?.firstName ? `Hola, ${user.firstName}` : 'Hola'}
        description="Tu bandeja operativa: leads primero, copiloto de propuesta y accesos rápidos."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/leads" className="group block">
          <PanelCard className="h-full border-cyan-500/15 transition-all hover:border-cyan-500/30 hover:shadow-md">
            <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-200">
              <Target className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-xs font-semibold uppercase tracking-wide">Prioridad</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">Leads</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Pipeline con inspector y ficha con IA.</p>
            <span className="mt-3 inline-block text-xs font-medium text-cyan-700 group-hover:underline dark:text-cyan-300">
              Abrir →
            </span>
          </PanelCard>
        </Link>
        <Link to="/app/motor" className="group block">
          <PanelCard className="h-full transition-all hover:border-violet-400/25 hover:shadow-md">
            <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
              <Radar className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">Motor</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Visión del motor de recomendación y métricas.</p>
            <span className="mt-3 inline-block text-xs font-medium text-violet-700 group-hover:underline dark:text-violet-300">
              Explorar →
            </span>
          </PanelCard>
        </Link>
        <Link to="/profile" className="group block sm:col-span-2 lg:col-span-1">
          <PanelCard className="h-full transition-all hover:shadow-md">
            <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              <UserCircle className="h-4 w-4" strokeWidth={1.75} />
              <span className="text-xs font-semibold uppercase tracking-wide">Cuenta</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-white">Perfil y sesiones</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Seguridad y dispositivos conectados.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-700 group-hover:underline dark:text-zinc-300">
              <Sparkles className="h-3 w-3 text-cyan-500" />
              Configurar
            </span>
          </PanelCard>
        </Link>
      </div>

      <PanelCard>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Abre un lead y usa <strong className="font-medium text-zinc-900 dark:text-zinc-200">Copiloto</strong> arriba del todo para
          ver intención y saltar a la <strong className="font-medium text-zinc-900 dark:text-zinc-200">propuesta IA</strong> (
          <kbd className="rounded border border-zinc-200 bg-zinc-100 px-1 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
            #propuesta
          </kbd>
          ).
        </p>
      </PanelCard>
    </div>
  );
}
