import { Link } from 'react-router-dom';

export function SessionExpiredPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b] px-4 text-center text-zinc-300">
      <h1 className="text-xl font-semibold text-white">Sesión caducada</h1>
      <p className="mt-2 w-full text-sm text-zinc-500">
        Tu sesión ha expirado o se ha cerrado. Vuelve a identificarte para continuar.
      </p>
      <Link
        to="/login"
        className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
      >
        Ir al login
      </Link>
    </div>
  );
}
