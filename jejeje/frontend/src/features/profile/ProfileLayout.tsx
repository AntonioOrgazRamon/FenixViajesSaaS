import { Outlet } from 'react-router-dom';

/** Agrupa rutas de perfil; la navegación entre secciones está en el sidebar (Perfil → Cuenta / Contraseña / Sesiones). */
export function ProfileLayout() {
  return <Outlet />;
}
