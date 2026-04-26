import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProcessRequest, ProcessResponse } from '../models/number-process.model';

@Injectable({
  providedIn: 'root'
})
export class N8nService {
  // Volvemos a la URL de TEST para desarrollo local
  private readonly N8N_WEBHOOK_URL = 'https://cebollita.app.n8n.cloud/webhook-test/procesar-numeros';
  

  constructor(private http: HttpClient) {}

  processNumbers(data: ProcessRequest): Observable<ProcessResponse> {
    return this.http.post<ProcessResponse>(this.N8N_WEBHOOK_URL, data);
  }
}
