import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard/dashboard.component';
import { inject } from '@angular/core';
import { AuthService } from './core/auth/auth.service';
import { Router } from '@angular/router';

const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.currentUser()) return true;
  return router.parseUrl('/login');
};

const guestGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.currentUser()) return true;
  return router.parseUrl('/dashboard');
};

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { 
    path: 'dashboard', 
    component: DashboardComponent, 
    canActivate: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./features/dashboard/dashboard-home/dashboard-home.component').then(m => m.DashboardHomeComponent) },
      { path: 'admin/companies', loadComponent: () => import('./features/admin/admin-companies/admin-companies.component').then(m => m.AdminCompaniesComponent) }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
