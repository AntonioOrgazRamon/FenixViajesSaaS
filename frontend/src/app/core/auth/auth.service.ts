import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, LoginDto, User } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Apuntamos al backend local de Spring Boot
  private readonly API_URL = 'http://localhost:8080/api/auth';
  
  currentUser = signal<User | null>(null);
  activeCompanyId = signal<number | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    this.loadStateFromStorage();
  }

  login(credentials: LoginDto): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(res => {
        this.saveTokens(res.accessToken, res.refreshToken);
        this.currentUser.set(res.user);
        localStorage.setItem('user_data', JSON.stringify(res.user));
        
        if (!res.user.isSuperAdmin && res.user.memberships.length === 1) {
          this.setActiveCompany(res.user.memberships[0].companyId);
        }
      })
    );
  }

  logout(): void {
    this.clearState();
    this.router.navigate(['/login']);
  }

  setActiveCompany(companyId: number): void {
    this.activeCompanyId.set(companyId);
    localStorage.setItem('active_tenant', companyId.toString());
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  isSuperAdmin(): boolean {
    return this.currentUser()?.isSuperAdmin ?? false;
  }

  getRoleForCompany(companyId: number): string | null {
    const user = this.currentUser();
    if (!user) return null;
    const membership = user.memberships.find(m => m.companyId === companyId);
    return membership ? membership.role : null;
  }

  private saveTokens(access: string, refresh: string): void {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  private clearState(): void {
    localStorage.clear();
    this.currentUser.set(null);
    this.activeCompanyId.set(null);
  }

  private loadStateFromStorage(): void {
    const userStr = localStorage.getItem('user_data');
    const tenantStr = localStorage.getItem('active_tenant');
    if (userStr) this.currentUser.set(JSON.parse(userStr));
    if (tenantStr) this.activeCompanyId.set(Number(tenantStr));
  }
}
