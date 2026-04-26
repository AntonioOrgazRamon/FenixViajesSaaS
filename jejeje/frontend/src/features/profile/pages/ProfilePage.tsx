import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { useAuthStore, type AuthUser } from '../../../store/authStore';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PanelCard } from '../../../components/ui/PanelCard';
import { writeStoredThemePreference } from '../../../lib/theme';
import { cn } from '../../../lib/cn';

const schema = z.object({
  firstName: z.string().min(2).optional().or(z.literal('')),
  lastName: z.string().min(2).optional().or(z.literal('')),
  phone: z.string().optional(),
  language: z.enum(['es', 'en']).optional(),
  timezone: z.string().optional(),
  theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
});

const emailSchema = z.object({
  new_email: z.string().email(),
  password: z.string().min(1),
});

const avatarSchema = z.object({
  avatarUrl: z.string().url().max(500),
});

type Form = z.infer<typeof schema>;

export function ProfilePage() {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery<AuthUser>({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: AuthUser }>('/profile');
      return unwrap(body);
    },
  });

  const form = useForm<Form>({ resolver: zodResolver(schema) });
  const emailForm = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
  const avatarForm = useForm<z.infer<typeof avatarSchema>>({ resolver: zodResolver(avatarSchema) });

  useEffect(() => {
    if (!data) return;
    form.reset({
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      phone: data.phone ?? '',
      language: (data.language as 'es' | 'en') ?? 'es',
      timezone: data.timezone ?? '',
      theme: (data.theme as 'LIGHT' | 'DARK' | 'SYSTEM') ?? 'SYSTEM',
    });
  }, [data, form]);

  const mutation = useMutation<AuthUser, Error, Form>({
    mutationFn: async (values: Form) => {
      const payload = {
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
        phone: values.phone || undefined,
        language: values.language,
        timezone: values.timezone || undefined,
        theme: values.theme,
      };
      const { data: body } = await api.patch<{ success: boolean; data: AuthUser }>('/profile', payload);
      return unwrap(body);
    },
    onSuccess: (patch: AuthUser) => {
      const prev = useAuthStore.getState().user;
      if (prev) setUser({ ...prev, ...patch });
      if (patch.theme) writeStoredThemePreference(patch.theme);
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async (values: z.infer<typeof emailSchema>) => {
      const { data: body } = await api.patch<{ success: boolean; data: { email: string } }>('/profile/email', values);
      return unwrap<{ email: string }>(body);
    },
    onSuccess: (res: { email: string }) => {
      const prev = useAuthStore.getState().user;
      if (prev) setUser({ ...prev, email: res.email });
      qc.invalidateQueries({ queryKey: ['profile'] });
      emailForm.reset();
    },
  });

  const syncAvatarInSession = (avatar_url: string | null) => {
    const prev = useAuthStore.getState().user;
    if (prev) setUser({ ...prev, avatar_url: avatar_url ?? null });
  };

  const avatarMutation = useMutation({
    mutationFn: async (values: z.infer<typeof avatarSchema>) => {
      const { data: body } = await api.post('/profile/avatar', values);
      return unwrap<{ avatar_url: string }>(body as { success: boolean; data: { avatar_url: string } });
    },
    onSuccess: (data) => {
      syncAvatarInSession(data.avatar_url);
      qc.invalidateQueries({ queryKey: ['profile'] });
      avatarForm.reset();
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data: body } = await api.post<{ success: boolean; data: { avatar_url: string } }>('/profile/avatar/upload', fd);
      return unwrap<{ avatar_url: string }>(body);
    },
    onSuccess: (data) => {
      syncAvatarInSession(data.avatar_url);
      qc.invalidateQueries({ queryKey: ['profile'] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      const { data: body } = await api.delete('/profile/avatar');
      return unwrap(body as { success: boolean; data: { avatar_url: null } });
    },
    onSuccess: () => {
      syncAvatarInSession(null);
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  if (isLoading) return <p className="text-sm text-zinc-500">Cargando perfil…</p>;
  if (error) return <p className="text-sm text-red-400">No se pudo cargar el perfil.</p>;

  const field = cn(
    'mt-0.5 w-full rounded-md border px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-amber-400/30',
    'border-zinc-300 bg-white text-zinc-900',
    'dark:border-white/10 dark:bg-black/30 dark:text-zinc-100',
  );
  const label = 'text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500';

  return (
    <div className="w-full min-w-0 space-y-3">
      <PageHeader title="Cuenta y preferencias" description={data?.email ?? ''} />

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <PanelCard className="min-w-0 lg:col-span-1 xl:col-span-1">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Datos personales</h2>
          <form className="mt-2 space-y-2" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className={label}>Nombre</label>
                <input className={field} {...form.register('firstName')} />
              </div>
              <div>
                <label className={label}>Apellidos</label>
                <input className={field} {...form.register('lastName')} />
              </div>
            </div>
            <div>
              <label className={label}>Teléfono</label>
              <input className={field} {...form.register('phone')} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className={label}>Idioma</label>
                <select className={field} {...form.register('language')}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label className={label}>Tema</label>
                <select className={field} {...form.register('theme')}>
                  <option value="SYSTEM">Sistema</option>
                  <option value="LIGHT">Claro</option>
                  <option value="DARK">Oscuro</option>
                </select>
              </div>
            </div>
            <div>
              <label className={label}>Zona horaria</label>
              <input className={field} placeholder="Europe/Madrid" {...form.register('timezone')} />
            </div>
            {mutation.isError && <p className="text-xs text-red-400">{getApiErrorMessage(mutation.error)}</p>}
            {mutation.isSuccess && <p className="text-xs text-emerald-400/90">Guardado.</p>}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </form>
        </PanelCard>

        <PanelCard className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Correo</h2>
          <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-600">Requiere contraseña actual.</p>
          <form className="mt-2 space-y-2" onSubmit={emailForm.handleSubmit((v) => emailMutation.mutate(v))}>
            <div>
              <label className={label}>Nuevo email</label>
              <input type="email" className={field} {...emailForm.register('new_email')} />
            </div>
            <div>
              <label className={label}>Contraseña actual</label>
              <input type="password" className={field} {...emailForm.register('password')} />
            </div>
            {emailMutation.isError && <p className="text-xs text-red-400">{getApiErrorMessage(emailMutation.error)}</p>}
            <button
              type="submit"
              disabled={emailMutation.isPending}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:border-white/12 dark:text-zinc-200 dark:hover:bg-white/5"
            >
              Actualizar email
            </button>
          </form>
        </PanelCard>

        <PanelCard className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Avatar</h2>
          <p className="mt-0.5 text-[11px] text-zinc-600">
            Sube una imagen (JPG, PNG, GIF o WebP, máx. 2&nbsp;MB) o indica una URL externa.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadAvatarMutation.mutate(f);
            }}
          />
          <div className="mt-2 flex flex-wrap items-start gap-3">
            {data?.avatar_url ? (
              <img
                src={data.avatar_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-full border border-zinc-200 object-cover dark:border-white/10"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-300 bg-zinc-100 text-[10px] text-zinc-500 dark:border-white/15 dark:bg-black/20 dark:text-zinc-600">
                —
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploadAvatarMutation.isPending}
                  className="rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadAvatarMutation.isPending ? 'Subiendo…' : 'Elegir archivo'}
                </button>
                <button
                  type="button"
                  disabled={deleteAvatarMutation.isPending || !data?.avatar_url}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 disabled:opacity-40 dark:border-white/12 dark:text-zinc-400"
                  onClick={() => deleteAvatarMutation.mutate()}
                >
                  Quitar
                </button>
              </div>
              {uploadAvatarMutation.isError && (
                <p className="text-xs text-red-400">{getApiErrorMessage(uploadAvatarMutation.error)}</p>
              )}
              <form className="space-y-2" onSubmit={avatarForm.handleSubmit((v) => avatarMutation.mutate(v))}>
                <div>
                  <label className={label}>O URL externa</label>
                  <input className={field} placeholder="https://…" {...avatarForm.register('avatarUrl')} />
                </div>
                <button
                  type="submit"
                  disabled={avatarMutation.isPending}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-800 hover:bg-zinc-100 disabled:opacity-50 dark:border-white/12 dark:text-zinc-200 dark:hover:bg-white/5"
                >
                  Guardar URL
                </button>
              </form>
            </div>
          </div>
          <p className="mt-3 border-t border-zinc-200/90 pt-2 text-[10px] leading-relaxed text-zinc-600 dark:border-white/[0.06]">
            Google OAuth: {data?.has_google_linked ? 'vinculado' : 'no vinculado'} · {data?.auth_provider ?? 'LOCAL'}.
            Servidor <code className="text-zinc-500">/auth/google/*</code> en 501 hasta configurar cliente.
          </p>
        </PanelCard>
      </div>
    </div>
  );
}
