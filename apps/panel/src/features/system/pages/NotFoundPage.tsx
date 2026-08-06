import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#09090b] px-4 text-center text-zinc-300">
      <p className="text-6xl font-bold text-amber-400/90">404</p>
      <h1 className="mt-4 text-xl font-semibold text-white">Página no encontrada</h1>
      <p className="mt-2 w-full text-sm text-zinc-500">La ruta no existe o ha cambiado.</p>
      <Link
        to="/login"
        className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
      >
        Ir al acceso
      </Link>
    </div>
  );
}
