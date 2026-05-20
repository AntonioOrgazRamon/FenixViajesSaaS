import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

const LS_TOKEN = 'tlfa_bearer_token';
const LS_API = 'tlfa_api_base_url';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  get apiBaseUrl(): string {
    const o = localStorage.getItem(LS_API);
    return (o?.trim() || environment.apiBaseUrl).replace(/\/$/, '');
  }

  set apiBaseUrl(v: string) {
    localStorage.setItem(LS_API, v.trim().replace(/\/$/, ''));
  }

  get bearerToken(): string {
    return localStorage.getItem(LS_TOKEN)?.trim() ?? '';
  }

  set bearerToken(v: string) {
    if (!v.trim()) localStorage.removeItem(LS_TOKEN);
    else localStorage.setItem(LS_TOKEN, v.trim());
  }

  get saasFrontendUrl(): string {
    return environment.saasFrontendUrl.replace(/\/$/, '');
  }

  get companyIdHint(): string {
    return environment.companyId;
  }

  clearToken(): void {
    localStorage.removeItem(LS_TOKEN);
  }
}
