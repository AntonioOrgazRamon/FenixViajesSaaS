import { Link } from 'react-router-dom';

export function UserBlockedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b] px-4 text-center text-zinc-300">
      <h1 className="text-xl font-semibold text-red-200">Cuenta no disponible</h1>
      <p className="mt-2 w-full text-sm text-zinc-500">
        Tu usuario está bloqueado o suspendido. Contacta con el administrador de tu empresa.
      </p>
      <Link
        to="/login"
        className="mt-8 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5"
      >
        Volver al login
      </Link>
    </div>
  );
}
