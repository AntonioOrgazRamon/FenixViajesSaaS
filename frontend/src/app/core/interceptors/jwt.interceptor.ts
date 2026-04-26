import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  const token = authService.getAccessToken();
  const activeCompanyId = authService.activeCompanyId();

  let headers = req.headers;
  
  // 1. Adjuntar Access Token
  if (token) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  
  // 2. Adjuntar ID de la empresa activa (para auditoría y validaciones extra)
  if (activeCompanyId) {
    headers = headers.set('X-Tenant-ID', activeCompanyId.toString());
  }

  const clonedReq = req.clone({ headers });

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el token expira o es inválido
      if (error.status === 401) {
        // TODO: Implementar lógica de Refresh Token aquí antes de desloguear
        authService.logout();
      }
      // Si intenta acceder a un recurso de otra empresa (IDOR)
      if (error.status === 403) {
        router.navigate(['/unauthorized']);
      }
      return throwError(() => error);
    })
  );
};
