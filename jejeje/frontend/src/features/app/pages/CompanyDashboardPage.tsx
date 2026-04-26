import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
    <div>
      <PageHeader
        title="Panel de empresa"
        description="Automatización de procesos con IA y gestión de tu organización."
      />
      <PanelCard className="w-full">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Usuarios en tu empresa</p>
        <p className="mt-2 text-3xl font-bold tabular-nums text-white">{data?.total ?? '—'}</p>
        <Link
          to="/app/users"
          className="mt-4 inline-flex items-center text-sm font-medium text-amber-400/95 transition-colors hover:text-amber-300"
        >
          Gestionar usuarios →
        </Link>
      </PanelCard>
    </div>
  );
}
