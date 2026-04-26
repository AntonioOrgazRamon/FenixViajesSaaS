import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { UserDetail } from '../../../types/domain';
import { appPageTitle } from '../../../lib/appTable';
import { UserDetailPanel } from '../../users/components/UserDetailPanel';

export function SuperUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery<UserDetail>({
    queryKey: ['user', id],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: UserDetail }>(`/users/${id}`);
      return unwrap(body);
    },
    enabled: !!id,
  });

  if (!id) return null;
  if (isLoading) return <p className="text-sm text-zinc-500">Cargando…</p>;
  if (error || !data) return <p className="text-sm text-red-400">Usuario no encontrado.</p>;

  return (
    <div>
      <Link
        to="/superadmin/users"
        className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
      >
        ← Usuarios
      </Link>
      <h1 className={`${appPageTitle} mt-3`}>Ficha de usuario</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-500">Vista ampliada con datos de cuenta, actividad y organización.</p>

      <div className="mt-4 w-full">
        <UserDetailPanel data={data} showCompanyAdminLink sessionsHref={`/superadmin/users/${id}/sessions`} />
      </div>

      <div className="mt-4 flex w-full flex-wrap gap-3">
        <Link
          to={`/superadmin/users/${id}/edit`}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-white/15 dark:text-zinc-200 dark:hover:bg-white/5"
        >
          Editar
        </Link>
      </div>
    </div>
  );
}
