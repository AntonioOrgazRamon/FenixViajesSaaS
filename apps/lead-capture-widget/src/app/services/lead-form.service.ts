import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { ApiSuccess, CreateLeadPayload, CreatedLeadData } from '../models/lead-capture.models';
import { AppSettingsService } from './app-settings.service';

@Injectable({ providedIn: 'root' })
export class LeadFormService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(AppSettingsService);

  private headersJson(): HttpHeaders {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const t = this.settings.bearerToken;
    if (t) h['Authorization'] = `Bearer ${t}`;
    return new HttpHeaders(h);
  }

  /** POST /api/v1/leads — JWT COMPANY_ADMIN / COMPANY_USER (empresa = claims del token). */
  createLead(body: CreateLeadPayload): Observable<ApiSuccess<CreatedLeadData>> {
    const url = `${this.settings.apiBaseUrl}/leads`;
    return this.http.post<ApiSuccess<CreatedLeadData>>(url, body, {
      headers: this.headersJson(),
    });
  }
}
