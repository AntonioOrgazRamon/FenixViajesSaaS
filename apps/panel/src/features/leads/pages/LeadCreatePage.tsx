import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';
import { buttonClassName } from '../../../lib/buttonStyles';
import { cn } from '../../../lib/cn';

const tripTypeZ = z.enum([
  'VACATIONAL',
  'HONEYMOON',
  'GROUP',
  'FAMILY',
  'BUSINESS',
  'OTHER',
  'UNKNOWN',
]);

const budgetTypeZ = z.enum(['PER_PERSON', 'TOTAL', 'UNKNOWN']);

const schema = z.object({
  name: z.string().min(1, 'Nombre obligatorio'),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
  destinationText: z.string().optional(),
  activitiesText: z.string().optional(),
  travelDateText: z.string().optional(),
  travelDateFrom: z.string().optional(),
  travelDateTo: z.string().optional(),
  flexibleDates: z.boolean().optional(),
  budgetAmount: z.string().optional(),
  budgetCurrency: z.string().optional(),
  budgetType: budgetTypeZ.optional(),
  tripType: tripTypeZ.optional(),
  departureAirportText: z.string().optional(),
});

type Form = z.infer<typeof schema>;

const field =
  'mt-1 w-full rounded-lg border border-zinc-200/90 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900/60 dark:text-zinc-100';

export function LeadCreatePage() {
  const navigate = useNavigate();
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      message: '',
      destinationText: '',
      activitiesText: '',
      travelDateText: '',
      travelDateFrom: '',
      travelDateTo: '',
      flexibleDates: false,
      budgetAmount: '',
      budgetCurrency: 'EUR',
      budgetType: 'UNKNOWN',
      tripType: 'VACATIONAL',
      departureAirportText: '',
    },
  });

  const createM = useMutation({
    mutationFn: async (v: Form) => {
      const budgetRaw = v.budgetAmount?.trim();
      const budgetAmount =
        budgetRaw && !Number.isNaN(Number(budgetRaw)) ? Number(budgetRaw) : undefined;
      const travelProfile =
        v.destinationText?.trim() ||
        v.activitiesText?.trim() ||
        v.travelDateText?.trim() ||
        v.travelDateFrom ||
        v.travelDateTo ||
        budgetAmount != null ||
        v.budgetType !== 'UNKNOWN' ||
        v.tripType !== 'UNKNOWN' ||
        v.departureAirportText?.trim()
          ? {
              destinationText: v.destinationText?.trim() || null,
              activitiesText: v.activitiesText?.trim() || null,
              travelDateText: v.travelDateText?.trim() || null,
              travelDateFrom: v.travelDateFrom ? new Date(v.travelDateFrom).toISOString() : null,
              travelDateTo: v.travelDateTo ? new Date(v.travelDateTo).toISOString() : null,
              flexibleDates: v.flexibleDates ?? null,
              budgetAmount: budgetAmount ?? null,
              budgetCurrency: v.budgetCurrency || 'EUR',
              budgetType: v.budgetType ?? 'UNKNOWN',
              tripType: v.tripType ?? 'UNKNOWN',
              departureAirportText: v.departureAirportText?.trim() || null,
            }
          : undefined;

      const { data } = await api.post('/leads', {
        name: v.name.trim(),
        email: v.email?.trim() || null,
        phone: v.phone?.trim() || null,
        message: v.message?.trim() || null,
        travelProfile,
      });
      return unwrap(data) as { id: string };
    },
    onSuccess: (d) => navigate(`/leads/${d.id}`),
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader title="Nuevo lead" description="Datos de contacto y, opcionalmente, perfil de viaje para propuestas." />
      <form
        onSubmit={form.handleSubmit((v) => createM.mutate(v))}
        className="grid max-w-3xl gap-6"
      >
        <PanelCard>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Contacto</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Nombre completo</label>
              <input className={field} {...form.register('name')} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Email</label>
              <input className={field} type="email" {...form.register('email')} />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Teléfono</label>
              <input className={field} {...form.register('phone')} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Notas adicionales</label>
              <textarea rows={3} className={field} {...form.register('message')} />
            </div>
          </div>
        </PanelCard>

        <PanelCard>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Perfil de viaje (opcional)</h2>
          <p className="mt-1 text-xs text-zinc-500">Estos campos alimentan el motor de propuestas con prioridad sobre mensajes sueltos.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Destino</label>
              <input className={field} placeholder="Ej. Tailandia / Japón" {...form.register('destinationText')} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Actividades / hobbies</label>
              <textarea rows={2} className={field} {...form.register('activitiesText')} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-zinc-500">Fecha (texto libre)</label>
              <input className={field} placeholder="Ej. octubre 2026" {...form.register('travelDateText')} />
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
              <input type="checkbox" id="flex" {...form.register('flexibleDates')} />
              <label htmlFor="flex" className="text-sm text-zinc-700 dark:text-zinc-300">
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
              <label className="text-xs text-zinc-500">Tipo de importe</label>
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
              <input className={field} placeholder="Ej. Madrid" {...form.register('departureAirportText')} />
            </div>
          </div>
        </PanelCard>

        {createM.isError && <p className="text-sm text-red-500">{getApiErrorMessage(createM.error)}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={createM.isPending}
            className={cn(buttonClassName('primary', 'touch'), 'shadow-md shadow-cyan-900/20')}
          >
            Crear lead
          </button>
          <button type="button" className={buttonClassName('secondary', 'touch')} onClick={() => navigate('/leads')}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
