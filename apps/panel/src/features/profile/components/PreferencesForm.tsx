import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import type { AuthUser } from '../../../store/authStore';
import { ProfileSectionCard } from './ProfileSectionCard';
import { profileInputClass, profileLabelClass, profileSelectClass } from './profileFormStyles';
import { useUpdateProfileFields, humanizeProfileSaveError, type ProfilePatch } from '../hooks/useUpdateProfileFields';
import { formatNowPreview } from '../lib/accountLabels';
import { cn } from '../../../lib/cn';

const schema = z.object({
  language: z.enum(['es', 'en']),
  timezone: z.string().max(100),
  timeFormat: z.enum(['24h', '12h']),
  dateFormat: z.enum(['dmy', 'mdy', 'ymd', 'locale']),
});

type Prefs = z.infer<typeof schema>;

function buildPatch(values: Prefs, dirty: Partial<Record<keyof Prefs, boolean>>): ProfilePatch {
  const p: ProfilePatch = {};
  if (dirty.language) p.language = values.language;
  if (dirty.timezone) p.timezone = values.timezone?.trim() || undefined;
  if (dirty.timeFormat) p.timeFormat = values.timeFormat;
  if (dirty.dateFormat) p.dateFormat = values.dateFormat;
  return p;
}

export function PreferencesForm({ data, embedded }: { data: AuthUser; embedded?: boolean }) {
  const [showSaved, setShowSaved] = useState(false);
  const mutation = useUpdateProfileFields();
  const form = useForm<Prefs>({
    resolver: zodResolver(schema),
    defaultValues: {
      language: data.language ?? 'es',
      timezone: data.timezone ?? '',
      timeFormat: (data.timeFormat as Prefs['timeFormat']) ?? '24h',
      dateFormat: (data.dateFormat as Prefs['dateFormat']) ?? 'locale',
    },
  });

  useEffect(() => {
    form.reset({
      language: data.language ?? 'es',
      timezone: data.timezone ?? '',
      timeFormat: (data.timeFormat as Prefs['timeFormat']) ?? '24h',
      dateFormat: (data.dateFormat as Prefs['dateFormat']) ?? 'locale',
    });
  }, [data.id, data.language, data.timezone, data.timeFormat, data.dateFormat, form]);

  useEffect(() => {
    if (form.formState.isDirty) setShowSaved(false);
  }, [form.formState.isDirty]);

  const onSubmit = (values: Prefs) => {
    const patch = buildPatch(values, form.formState.dirtyFields);
    if (Object.keys(patch).length === 0) return;
    mutation.mutate(patch, {
      onSuccess: () => {
        form.reset(values);
        setShowSaved(true);
      },
    });
  };

  const isDirty = form.formState.isDirty;
  const isIdle = !mutation.isPending;
  const wLang = form.watch('language');
  const wTf = form.watch('timeFormat');
  const wTz = form.watch('timezone');

  const formEl = (
    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className={profileLabelClass} htmlFor="pr-lang">
              Idioma de la interfaz
            </label>
            <select id="pr-lang" className={profileSelectClass} {...form.register('language')}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className={profileLabelClass} htmlFor="pr-time">
              Hora
            </label>
            <select id="pr-time" className={profileSelectClass} {...form.register('timeFormat')}>
              <option value="24h">24 horas</option>
              <option value="12h">12 horas (am/pm)</option>
            </select>
          </div>
        </div>
        <div>
          <label className={profileLabelClass} htmlFor="pr-df">
            Orden y estilo de fecha
          </label>
          <select id="pr-df" className={profileSelectClass} {...form.register('dateFormat')}>
            <option value="locale">Según el idioma (recomendado)</option>
            <option value="dmy">Día · mes · año (21/04/2026)</option>
            <option value="mdy">Mes · día · año (04/21/2026)</option>
            <option value="ymd">Año · mes · día (2026-04-21)</option>
          </select>
        </div>
        <div>
          <label className={profileLabelClass} htmlFor="pr-tz">
            Zona horaria (IANA)
          </label>
          <input
            id="pr-tz"
            className={profileInputClass}
            placeholder="Europe/Madrid"
            {...form.register('timezone')}
          />
        </div>
        <div className="rounded-lg border border-dashed border-zinc-200/80 bg-zinc-50/50 px-3 py-2 text-[11px] text-zinc-600 dark:border-white/10 dark:bg-zinc-900/30 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Vista previa (ahora, según reloj y zona): </span>
          <span className="tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatNowPreview(wLang === 'en' ? 'en' : 'es', wTf, wTz?.trim() ? wTz : null)}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-zinc-500" aria-live="polite">
            {showSaved && isIdle
              ? 'Cambios guardados.'
              : !isDirty
                ? 'Sin cambios pendientes.'
                : 'Cambios sin guardar en preferencias.'}
          </p>
          <button
            type="submit"
            disabled={mutation.isPending || !isDirty}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              'bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar preferencias'}
          </button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-500" role="alert">
            {humanizeProfileSaveError(mutation.error)}
          </p>
        )}
    </form>
  );

  if (embedded) {
    return <div className="min-w-0">{formEl}</div>;
  }

  return (
    <ProfileSectionCard
      id="preferences"
      title="Preferencias regionales"
      description="Cómo mostramos reloj, fechas, idioma y región. El aspecto (claro/oscuro) está en su propio bloque; se aplica al instante."
    >
      {formEl}
    </ProfileSectionCard>
  );
}
