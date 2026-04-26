import { Link } from 'react-router-dom';
import { useAuthStore, defaultPathForRole } from '../../../store/authStore';

export function ForbiddenPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b] px-4 text-center text-zinc-300">
      <p className="text-6xl font-bold text-red-400/80">403</p>
      <h1 className="mt-4 text-xl font-semibold text-white">Acceso denegado</h1>
      <p className="mt-2 w-full text-sm text-zinc-500">No tienes permisos para ver este recurso.</p>
      {token && user ? (
        <Link
          to={defaultPathForRole(user.role)}
          className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
        >
          Volver al panel
        </Link>
      ) : (
        <Link
          to="/login"
          className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
        >
          Iniciar sesión
        </Link>
      )}
    </div>
  );
}
