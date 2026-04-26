import { useAuthStore } from '../../../store/authStore';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';

export function AppHomePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <PageHeader
        title={user?.firstName ? `Hola, ${user.firstName}` : 'Hola'}
        description="Tu espacio de trabajo: perfil, contraseña y sesiones activas."
      />
      <PanelCard className="w-full">
        <p className="text-sm leading-relaxed text-zinc-400">
          Accede a tus datos de cuenta o revisa en qué dispositivos tienes iniciada sesión.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/profile"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-900/25 transition-[filter] hover:brightness-105"
          >
            Mi perfil
          </Link>
          <Link
            to="/profile/sessions"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.06]"
          >
            Mis sesiones
          </Link>
        </div>
      </PanelCard>
    </div>
  );
}
