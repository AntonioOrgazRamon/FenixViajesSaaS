import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const roleGuard = (requiredRole: 'COMPANY_ADMIN' | 'USER'): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    // 1. Super Admin siempre tiene acceso total
    if (authService.isSuperAdmin()) {
      return true;
    }

    // 2. Verificar que haya una empresa seleccionada en el contexto
    const activeCompanyId = authService.activeCompanyId();
    if (!activeCompanyId) {
      router.navigate(['/select-company']);
      return false;
    }

    // 3. Verificar el rol dentro de esa empresa específica
    const userRole = authService.getRoleForCompany(activeCompanyId);
    
    // COMPANY_ADMIN hereda los permisos de USER
    if (userRole === 'COMPANY_ADMIN' || userRole === requiredRole) {
      return true;
    }

    // No tiene el rol necesario
    router.navigate(['/unauthorized']);
    return false;
  };
};
