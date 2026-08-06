import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import type { AuthUser } from '../../../store/authStore';
import { ProfileSectionCard } from './ProfileSectionCard';
import { profileInputClass, profileLabelClass } from './profileFormStyles';
import { useUpdateProfileFields, humanizeProfileSaveError, type ProfilePatch } from '../hooks/useUpdateProfileFields';
import { cn } from '../../../lib/cn';

const personalSchema = z.object({
  firstName: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  lastName: z.string().min(2, 'Mínimo 2 caracteres').max(100),
  displayName: z.string().max(150).optional().or(z.literal('')),
  phone: z.string().max(32).optional().or(z.literal('')),
});

type PersonalForm = z.infer<typeof personalSchema>;

function buildPatch(values: PersonalForm, dirty: Partial<Record<keyof PersonalForm, boolean>>): ProfilePatch {
  const p: ProfilePatch = {};
  if (dirty.firstName) p.firstName = values.firstName;
  if (dirty.lastName) p.lastName = values.lastName;
  if (dirty.displayName) p.displayName = values.displayName?.trim() ? values.displayName.trim() : null;
  if (dirty.phone) p.phone = values.phone?.trim() || undefined;
  return p;
}

export function PersonalInfoForm({ data, embedded }: { data: AuthUser; embedded?: boolean }) {
  const [showSaved, setShowSaved] = useState(false);
  const mutation = useUpdateProfileFields();
  const form = useForm<PersonalForm>({
    resolver: zodResolver(personalSchema),
    defaultValues: {
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      displayName: data.displayName ?? '',
      phone: data.phone ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      displayName: data.displayName ?? '',
      phone: data.phone ?? '',
    });
  }, [data.id, data.firstName, data.lastName, data.displayName, data.phone, form]);

  useEffect(() => {
    if (form.formState.isDirty) setShowSaved(false);
  }, [form.formState.isDirty]);

  const onSubmit = (values: PersonalForm) => {
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

  const formEl = (
    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className={profileLabelClass} htmlFor="pi-firstName">
              Nombre
            </label>
            <input id="pi-firstName" className={profileInputClass} {...form.register('firstName')} />
            {form.formState.errors.firstName && (
              <p className="mt-1 text-xs text-red-500" role="alert">
                {form.formState.errors.firstName.message}
              </p>
            )}
          </div>
          <div>
            <label className={profileLabelClass} htmlFor="pi-lastName">
              Apellidos
            </label>
            <input id="pi-lastName" className={profileInputClass} {...form.register('lastName')} />
            {form.formState.errors.lastName && (
              <p className="mt-1 text-xs text-red-500" role="alert">
                {form.formState.errors.lastName.message}
              </p>
            )}
          </div>
        </div>
        <div>
          <label className={profileLabelClass} htmlFor="pi-displayName">
            Nombre visible
          </label>
          <input
            id="pi-displayName"
            className={profileInputClass}
            placeholder="Opcional, puede coincidir con el nombre de firma"
            {...form.register('displayName')}
          />
        </div>
        <div>
          <label className={profileLabelClass} htmlFor="pi-phone">
            Teléfono
          </label>
          <input id="pi-phone" className={profileInputClass} type="tel" {...form.register('phone')} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-zinc-500" aria-live="polite">
            {showSaved && isIdle
              ? 'Cambios guardados.'
              : !isDirty
                ? 'Sin cambios pendientes.'
                : 'Tienes cambios sin guardar.'}
          </p>
          <button
            type="submit"
            disabled={mutation.isPending || !isDirty}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold',
              'bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar datos personales'}
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
      id="personal"
      title="Datos personales"
      description="Identificación en el directorio. Los cambios se aplican en la organización según su política."
    >
      {formEl}
    </ProfileSectionCard>
  );
}
