import { Outlet, useLocation } from 'react-router-dom';
import { ProfileSubNav } from './components/ProfileSubNav';

/**
 * Rutas: Cuenta (index), contraseña, sesiones.
 * Raíz: barra lateral con ?section=…; en contraseña/sesiones: miga Cuenta &gt; Seguridad &gt; …
 */
export function ProfileLayout() {
  const { pathname } = useLocation();
  const isProfileIndex = pathname === '/profile' || pathname === '/profile/';
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      {!isProfileIndex ? <ProfileSubNav /> : null}
      <div className="min-h-0 min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
