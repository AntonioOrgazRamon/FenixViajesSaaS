import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { environment } from '../../environments/environment';
import type {
  CreateLeadPayload,
  CreatedLeadData,
  TravelLeadBudgetType,
  TravelLeadTripType,
} from '../models/lead-capture.models';
import { AppSettingsService } from '../services/app-settings.service';
import { LeadFormService } from '../services/lead-form.service';

/** Chips alineados con tags frecuentes en catálogo / intención (texto visible = valor enviado). */
export const ACTIVITY_CHIP_LABELS: string[] = [
  'Cultura',
  'Gastronomía',
  'Naturaleza',
  'Playa',
  'Aventura',
  'Relax',
  'Lujo',
  'Templos',
  'Compras',
  'Vino',
  'Safari',
  'Crucero',
  'Familia',
  'Trekking',
  'Ciudad',
  'Wellness',
];

@Component({
  selector: 'app-lead-capture',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './lead-capture.component.html',
  styleUrl: './lead-capture.component.scss',
})
export class LeadCaptureComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly leadApi = inject(LeadFormService);
  readonly settings = inject(AppSettingsService);

  readonly activityChips = ACTIVITY_CHIP_LABELS;
  /** Tags seleccionados (valores enviados en `activityTags`). */
  selectedActivityTags = new Set<string>();

  readonly tripOptions: { value: TravelLeadTripType; label: string }[] = [
    { value: 'VACATIONAL', label: 'Vacacional' },
    { value: 'HONEYMOON', label: 'Luna de miel' },
    { value: 'GROUP', label: 'Grupo' },
    { value: 'FAMILY', label: 'Familiar' },
    { value: 'BUSINESS', label: 'Empresa / negocios' },
    { value: 'OTHER', label: 'Otro' },
  ];

  readonly budgetTypeOptions: { value: TravelLeadBudgetType; label: string }[] = [
    { value: 'PER_PERSON', label: 'Por persona' },
    { value: 'TOTAL', label: 'Total del viaje' },
    { value: 'UNKNOWN', label: 'No lo sé' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.maxLength(50)]],
    destination: ['', [Validators.required, Validators.maxLength(500)]],
    preferredDestinationsRaw: ['', [Validators.maxLength(2000)]],
    activities: ['', [Validators.maxLength(8000)]],
    travelDate: ['', [Validators.maxLength(500)]],
    travelDateFrom: [''],
    travelDateTo: [''],
    durationDays: this.fb.control<number | null>(null),
    budget: this.fb.control<number | null>(null),
    budgetType: this.fb.nonNullable.control<TravelLeadBudgetType>('PER_PERSON'),
    tripType: this.fb.nonNullable.control<TravelLeadTripType>('VACATIONAL', [
      Validators.required,
    ]),
    departureAirport: ['', [Validators.maxLength(200)]],
    notes: ['', [Validators.maxLength(20000)]],
  });

  settingsOpen = false;
  settingsToken = '';
  settingsApiBase = '';

  submitting: 'idle' | 'sending' = 'idle';
  errorMessage: string | null = null;
  successLead: CreatedLeadData | null = null;

  ngOnInit(): void {
    this.settingsToken = this.settings.bearerToken;
    this.settingsApiBase = this.settings.apiBaseUrl;
  }

  toggleSettings(): void {
    this.settingsOpen = !this.settingsOpen;
  }

  applySettings(): void {
    this.settings.bearerToken = this.settingsToken;
    this.settings.apiBaseUrl = this.settingsApiBase || this.settings.apiBaseUrl;
    this.errorMessage = null;
  }

  clearToken(): void {
    this.settings.clearToken();
    this.settingsToken = '';
  }

  chipActive(label: string): boolean {
    return this.selectedActivityTags.has(label);
  }

  toggleChip(label: string): void {
    if (this.selectedActivityTags.has(label)) {
      this.selectedActivityTags.delete(label);
    } else {
      this.selectedActivityTags.add(label);
    }
    this.selectedActivityTags = new Set(this.selectedActivityTags);
  }

  fillExample(): void {
    this.selectedActivityTags = new Set([
      'Cultura',
      'Gastronomía',
      'Naturaleza',
      'Templos',
    ]);
    this.form.patchValue({
      name: 'Laura Martínez',
      email: 'laura.qa@example.com',
      phone: '+34 600 000 123',
      destination: 'Asia',
      preferredDestinationsRaw: 'Tailandia, Japón',
      activities: 'cultura, gastronomía, naturaleza, templos, mercados locales',
      travelDate: 'octubre 2026',
      travelDateFrom: '',
      travelDateTo: '',
      durationDays: 14,
      budget: 4000,
      budgetType: 'PER_PERSON',
      tripType: 'HONEYMOON',
      departureAirport: 'Madrid',
      notes:
        'Queremos una luna de miel especial, cultural y gastronómica, con algo de naturaleza, sin que sea un viaje demasiado acelerado.',
    });
    this.errorMessage = null;
    this.successLead = null;
  }

  clearForm(): void {
    this.selectedActivityTags = new Set();
    this.form.reset({
      name: '',
      email: '',
      phone: '',
      destination: '',
      preferredDestinationsRaw: '',
      activities: '',
      travelDate: '',
      travelDateFrom: '',
      travelDateTo: '',
      durationDays: null,
      budget: null,
      budgetType: 'PER_PERSON',
      tripType: 'VACATIONAL',
      departureAirport: '',
      notes: '',
    });
    this.successLead = null;
    this.errorMessage = null;
  }

  private parsePreferredDestinations(raw: string): string[] | null {
    const parts = raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts.slice(0, 32) : null;
  }

  private dateInputToIso8601Utc(dateStr: string): string | null {
    const t = dateStr?.trim();
    if (!t) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
    return `${t}T12:00:00.000Z`;
  }

  buildPayload(): CreateLeadPayload {
    const v = this.form.getRawValue();
    const budgetVal = v.budget;
    const budgetAmount =
      budgetVal != null && !Number.isNaN(Number(budgetVal)) && Number(budgetVal) > 0
        ? Number(budgetVal)
        : null;

    const dur = v.durationDays;
    const durationDays =
      dur != null && !Number.isNaN(Number(dur))
        ? Math.floor(Number(dur))
        : null;
    const durationOk =
      durationDays != null && durationDays >= 1 && durationDays <= 365
        ? durationDays
        : null;

    const tags = [...this.selectedActivityTags];
    const preferred = this.parsePreferredDestinations(v.preferredDestinationsRaw);

    const travelProfile = {
      destinationText: v.destination.trim(),
      ...(preferred ? { preferredDestinations: preferred } : {}),
      activitiesText: v.activities.trim() || null,
      ...(tags.length ? { activityTags: tags } : {}),
      ...(durationOk != null ? { durationDays: durationOk } : { durationDays: null }),
      travelDateText: v.travelDate.trim() || null,
      travelDateFrom: this.dateInputToIso8601Utc(v.travelDateFrom),
      travelDateTo: this.dateInputToIso8601Utc(v.travelDateTo),
      ...(budgetAmount != null ? { budgetAmount } : { budgetAmount: null }),
      budgetCurrency: 'EUR',
      budgetType: v.budgetType,
      tripType: v.tripType,
      departureAirportText: v.departureAirport.trim() || null,
    };

    return {
      name: v.name.trim(),
      email: v.email.trim().toLowerCase(),
      phone: v.phone.trim() || null,
      message: v.notes.trim() || null,
      travelProfile,
    };
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage = null;
    this.submitting = 'sending';
    const body = this.buildPayload();

    if (environment.debugLogPayload) {
      console.log('[lead-capture] POST /leads body', JSON.stringify(body, null, 2));
    }

    this.leadApi
      .createLead(body)
      .pipe(finalize(() => (this.submitting = 'idle')))
      .subscribe({
        next: (res) => {
          this.successLead = res.data;
          if (environment.debugLogPayload) {
            console.log('[lead-capture] response', res);
          }
        },
        error: (err) => {
          this.successLead = null;
          this.errorMessage = this.formatHttpError(err);
        },
      });
  }

  saasLeadUrl(): string {
    if (!this.successLead?.id) return '';
    return `${this.settings.saasFrontendUrl}/leads/${this.successLead.id}`;
  }

  fieldInvalid(name: keyof typeof this.form.controls): boolean {
    const c = this.form.get(name as string);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  private formatHttpError(err: unknown): string {
    const e = err as {
      error?: { error?: { message?: string; code?: string } };
      message?: string;
      status?: number;
    };
    const msg = e?.error?.error?.message;
    if (msg) return msg;
    if (e?.status === 401) {
      return 'No autorizado: revisa el Bearer token (usuario de empresa activo).';
    }
    if (e?.status === 403) {
      return 'Prohibido: tu usuario no pertenece a la empresa esperada.';
    }
    if (e?.status === 0) {
      return 'No se pudo conectar al API (CORS, red o URL incorrecta).';
    }
    return e?.message || 'Error al contactar el servidor.';
  }
}
