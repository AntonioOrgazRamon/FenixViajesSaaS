import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, Radar, Target, Users } from 'lucide-react';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Paginated, UserListItem } from '../../../types/domain';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';

export function CompanyDashboardPage() {
  const { data } = useQuery<Paginated<UserListItem>>({
    queryKey: ['users', 'company-dash'],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: Paginated<UserListItem> }>('/users', {
        params: { page: 1, pageSize: 8 },
      });
      return unwrap(body);
    },
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        title="Inicio empresa"
        description="Resumen rápido y accesos como en un inbox operativo."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PanelCard className="border-cyan-500/15">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Equipo</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">{data?.total ?? '—'}</p>
          <Link
            to="/app/users"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
          >
            <Users className="h-4 w-4" strokeWidth={1.75} />
            Gestionar usuarios
          </Link>
        </PanelCard>
        <Link to="/leads" className="group block sm:col-span-1">
          <PanelCard className="h-full transition-all hover:border-cyan-400/30">
            <Target className="h-5 w-5 text-cyan-600 dark:text-cyan-400" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">Leads</p>
            <p className="mt-1 text-xs text-zinc-500">Captación y propuestas IA</p>
            <span className="mt-2 text-xs text-cyan-700 group-hover:underline dark:text-cyan-300">Ir →</span>
          </PanelCard>
        </Link>
        <Link to="/app/motor" className="group block sm:col-span-1">
          <PanelCard className="h-full transition-all hover:border-violet-400/25">
            <Radar className="h-5 w-5 text-violet-600 dark:text-violet-400" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">Motor</p>
            <p className="mt-1 text-xs text-zinc-500">Recomendación y explicabilidad</p>
            <span className="mt-2 text-xs text-violet-700 group-hover:underline dark:text-violet-300">Ir →</span>
          </PanelCard>
        </Link>
        <Link to="/app/ia" className="group block sm:col-span-2 lg:col-span-1">
          <PanelCard className="h-full transition-all hover:border-emerald-400/25">
            <Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">IA & costes</p>
            <p className="mt-1 text-xs text-zinc-500">Observabilidad y límites</p>
            <span className="mt-2 text-xs text-emerald-700 group-hover:underline dark:text-emerald-300">Ir →</span>
          </PanelCard>
        </Link>
      </div>
    </div>
  );
}
