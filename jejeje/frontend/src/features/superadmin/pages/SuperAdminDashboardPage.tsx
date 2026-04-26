import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { Paginated, Company, UserListItem } from '../../../types/domain';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';

export function SuperAdminDashboardPage() {
  const companies = useQuery<Paginated<Company>>({
    queryKey: ['companies', 'dash'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Paginated<Company> }>('/superadmin/companies', {
        params: { page: 1, pageSize: 5 },
      });
      return unwrap(data);
    },
  });
  const users = useQuery<Paginated<UserListItem>>({
    queryKey: ['users', 'dash'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Paginated<UserListItem> }>('/users', {
        params: { page: 1, pageSize: 5 },
      });
      return unwrap(data);
    },
  });

  return (
    <div>
      <PageHeader
        title="Superadmin"
        description="Resumen del ecosistema multiempresa: empresas y usuarios registrados."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <PanelCard>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Empresas</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">{companies.data?.total ?? '—'}</p>
          <Link
            to="/superadmin/tenants"
            className="mt-4 inline-flex items-center text-sm font-medium text-amber-400/95 transition-colors hover:text-amber-300"
          >
            Gestionar empresas →
          </Link>
        </PanelCard>
        <PanelCard>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Usuarios (total)</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-white">{users.data?.total ?? '—'}</p>
          <Link
            to="/superadmin/users"
            className="mt-4 inline-flex items-center text-sm font-medium text-amber-400/95 transition-colors hover:text-amber-300"
          >
            Ver usuarios →
          </Link>
        </PanelCard>
      </div>
    </div>
  );
}
