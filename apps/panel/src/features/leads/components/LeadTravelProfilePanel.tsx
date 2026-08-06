import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { PanelCard } from '../../../components/ui/PanelCard';
import { buttonClassName } from '../../../lib/buttonStyles';
import type { LeadTravelProfileDto } from '../../../types/domain';

const budgetTypeZ = z.enum(['PER_PERSON', 'TOTAL', 'UNKNOWN']);
const tripTypeZ = z.enum([
  'VACATIONAL',
  'HONEYMOON',
  'GROUP',
  'FAMILY',
  'BUSINESS',
  'OTHER',
  'UNKNOWN',
]);

const travelSchema = z.object({
  destinationText: z.string().optional(),
  activitiesText: z.string().optional(),
  travelDateText: z.string().optional(),
  travelDateFrom: z.string().optional(),
  travelDateTo: z.string().optional(),
  flexibleDates: z.boolean().optional(),
  budgetAmount: z.string().optional(),
  budgetCurrency: z.string().optional(),
  budgetType: budgetTypeZ,
  tripType: tripTypeZ,
  departureAirportText: z.string().optional(),
});

type TravelForm = z.infer<typeof travelSchema>;

const field =
  'mt-1 w-full rounded-lg border border-zinc-200/90 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100';

export function LeadTravelProfilePanel({ leadId, profile }: { leadId: string; profile: LeadTravelProfileDto | null }) {
  const qc = useQueryClient();

  const defaults = useMemo((): TravelForm => {
    const amt = profile?.budgetAmount != null ? String(profile.budgetAmount) : '';
    return {
      destinationText: profile?.destinationText ?? '',
      activitiesText: profile?.activitiesText ?? '',
      travelDateText: profile?.travelDateText ?? '',
      travelDateFrom: profile?.travelDateFrom?.slice(0, 10) ?? '',
      travelDateTo: profile?.travelDateTo?.slice(0, 10) ?? '',
      flexibleDates: profile?.flexibleDates ?? false,
      budgetAmount: amt,
      budgetCurrency: profile?.budgetCurrency ?? 'EUR',
      budgetType: (profile?.budgetType as TravelForm['budgetType']) ?? 'UNKNOWN',
      tripType: (profile?.tripType as TravelForm['tripType']) ?? 'VACATIONAL',
      departureAirportText: profile?.departureAirportText ?? '',
    };
  }, [profile]);

  const form = useForm<TravelForm>({
    resolver: zodResolver(travelSchema),
    values: defaults,
  });

  const saveM = useMutation({
    mutationFn: async (v: TravelForm) => {
      const budgetRaw = v.budgetAmount?.trim();
      const budgetAmount =
        budgetRaw && !Number.isNaN(Number(budgetRaw)) ? Number(budgetRaw) : null;
      const payload = {
        destinationText: v.destinationText?.trim() || null,
        activitiesText: v.activitiesText?.trim() || null,
        travelDateText: v.travelDateText?.trim() || null,
        travelDateFrom: v.travelDateFrom ? new Date(v.travelDateFrom).toISOString() : null,
        travelDateTo: v.travelDateTo ? new Date(v.travelDateTo).toISOString() : null,
        flexibleDates: v.flexibleDates ?? null,
        budgetAmount,
        budgetCurrency: v.budgetCurrency || 'EUR',
        budgetType: v.budgetType,
        tripType: v.tripType,
        departureAirportText: v.departureAirportText?.trim() || null,
      };
      const { data } = await api.patch(`/leads/${leadId}/travel-profile`, payload);
      return unwrap(data);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lead', leadId] }),
  });

  return (
    <PanelCard>
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Perfil de viaje</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Contrato de negocio para propuestas: tiene prioridad sobre mensaje libre y JSON legacy cuando está cumplimentado.
      </p>
      <form className="mt-4 space-y-3" onSubmit={form.handleSubmit((x) => saveM.mutate(x))}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-500">Destino</label>
            <input className={field} {...form.register('destinationText')} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-500">Actividades / hobbies</label>
            <textarea rows={2} className={field} {...form.register('activitiesText')} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-500">Fecha (texto)</label>
            <input className={field} {...form.register('travelDateText')} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Desde</label>
            <input className={field} type="date" {...form.register('travelDateFrom')} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Hasta</label>
            <input className={field} type="date" {...form.register('travelDateTo')} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" id="tp-flex" {...form.register('flexibleDates')} />
            <label htmlFor="tp-flex" className="text-sm text-zinc-700 dark:text-zinc-300">
              Fechas flexibles
            </label>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Presupuesto</label>
            <input className={field} inputMode="decimal" {...form.register('budgetAmount')} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Moneda</label>
            <select className={field} {...form.register('budgetCurrency')}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Importe</label>
            <select className={field} {...form.register('budgetType')}>
              <option value="UNKNOWN">No indicado</option>
              <option value="PER_PERSON">Por persona</option>
              <option value="TOTAL">Total</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Tipo de viaje</label>
            <select className={field} {...form.register('tripType')}>
              <option value="VACATIONAL">Vacacional</option>
              <option value="HONEYMOON">Luna de miel</option>
              <option value="GROUP">Grupo</option>
              <option value="FAMILY">Familiar</option>
              <option value="BUSINESS">Empresa / negocio</option>
              <option value="OTHER">Otro</option>
              <option value="UNKNOWN">—</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-500">Aeropuerto de salida</label>
            <input className={field} {...form.register('departureAirportText')} />
          </div>
        </div>
        {saveM.isError && <p className="text-sm text-red-500">{getApiErrorMessage(saveM.error)}</p>}
        <button type="submit" disabled={saveM.isPending} className={buttonClassName('primary', 'touch')}>
          Guardar perfil de viaje
        </button>
      </form>
    </PanelCard>
  );
}
