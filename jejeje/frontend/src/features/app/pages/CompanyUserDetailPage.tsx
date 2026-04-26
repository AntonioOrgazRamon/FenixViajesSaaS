import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import type { UserDetail } from '../../../types/domain';

export function CompanyUserDetailPage() {
  const canManage = useAuthStore((s) => s.user?.role === 'COMPANY_ADMIN');
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
      <Link to="/app/users" className="text-sm text-amber-400 hover:underline">
        ← Usuarios
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-white">{data.email}</h1>
      <p className="text-sm text-zinc-500">
        {data.firstName} {data.lastName}
      </p>
      <dl className="mt-6 w-full space-y-2 text-sm">
        <div className="flex justify-between border-b border-white/5 py-2">
          <dt className="text-zinc-500">Rol</dt>
          <dd className="text-zinc-200">{data.role}</dd>
        </div>
        <div className="flex justify-between border-b border-white/5 py-2">
          <dt className="text-zinc-500">Estado</dt>
          <dd className="text-zinc-200">{data.status}</dd>
        </div>
      </dl>
      {canManage && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/app/users/${id}/edit`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5 dark:border-white/15"
          >
            Editar
          </Link>
          <Link
            to={`/app/users/${id}/sessions`}
            className="rounded-lg border border-amber-500/30 px-4 py-2 text-sm text-amber-800 hover:bg-amber-500/10 dark:text-amber-200"
          >
            Sesiones
          </Link>
        </div>
      )}
    </div>
  );
}
