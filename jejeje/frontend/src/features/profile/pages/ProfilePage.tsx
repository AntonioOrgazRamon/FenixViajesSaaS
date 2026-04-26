import { useEffect, useRef, useState } from 'react';
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
import { UserAvatarView } from '../../../lib/userAvatarView';
import { DefaultAvatarEditor } from '../components/DefaultAvatarEditor';
import { buildDefaultPreview, type DefaultDraft } from '../defaultAvatarUtils';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

type Form = z.infer<typeof schema>;

export function ProfilePage() {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [defaultDraft, setDefaultDraft] = useState<DefaultDraft>({
    initials: '',
    backgroundColor: '#2563EB',
    textColor: '#FFFFFF',
    shape: 'circle',
  });
  const [photoAvatarTip, setPhotoAvatarTip] = useState<string | null>(null);
  const [defaultAvatarTip, setDefaultAvatarTip] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<AuthUser>({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: AuthUser }>('/profile');
      return unwrap(body);
    },
    staleTime: 0,
  });

  const form = useForm<Form>({ resolver: zodResolver(schema) });
  const emailForm = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });

  const applyToSession = (p: AuthUser) => {
    const prev = useAuthStore.getState().user;
    if (!prev) return;
    // Sustituir siempre el bloque de avatar/URL del servidor (evita mezclar con caché vieja de Zustand)
    setUser({
      ...prev,
      ...p,
      avatar: p.avatar,
      avatar_url: p.avatar_url,
    });
  };

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

  useEffect(() => {
    if (!data?.avatar) return;
    setDefaultDraft({
      initials: data.avatar.initials?.trim() ?? '',
      backgroundColor: data.avatar.backgroundColor,
      textColor: data.avatar.textColor,
      shape: data.avatar.shape,
    });
  }, [data?.id, data?.avatar?.backgroundColor, data?.avatar?.initials, data?.avatar?.shape, data?.avatar?.textColor, data?.avatar?.type]);

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  const clearPendingFile = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    setPendingFile(null);
    setFileError(null);
    setPhotoAvatarTip(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
    onSuccess: (patch) => {
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
    onSuccess: (res) => {
      const prev = useAuthStore.getState().user;
      if (prev) setUser({ ...prev, email: res.email });
      qc.invalidateQueries({ queryKey: ['profile'] });
      emailForm.reset();
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data: body } = await api.post<{ success: boolean; data: AuthUser }>('/profile/avatar/upload', fd);
      return unwrap<AuthUser>(body);
    },
    onMutate: () => {
      setPhotoAvatarTip(null);
    },
    onSuccess: (p) => {
      applyToSession(p);
      qc.invalidateQueries({ queryKey: ['profile'] });
      clearPendingFile();
      setPhotoAvatarTip('Imagen de perfil actualizada correctamente.');
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      const { data: body } = await api.delete<{ success: boolean; data: AuthUser }>('/profile/avatar');
      return unwrap(body);
    },
    onMutate: () => {
      setPhotoAvatarTip(null);
    },
    onSuccess: (p) => {
      applyToSession(p);
      qc.invalidateQueries({ queryKey: ['profile'] });
      setPhotoAvatarTip('Imagen eliminada. Ahora se usará tu avatar por defecto.');
    },
  });

  const defaultAvatarMutation = useMutation({
    mutationFn: async (draft: DefaultDraft) => {
      const { data: body } = await api.patch<{ success: boolean; data: AuthUser }>('/profile/avatar/default', {
        initials: draft.initials.trim() || null,
        backgroundColor: draft.backgroundColor,
        textColor: draft.textColor,
        shape: draft.shape,
      });
      return unwrap<AuthUser>(body);
    },
    onMutate: () => {
      setDefaultAvatarTip(null);
    },
    onSuccess: (p) => {
      applyToSession(p);
      qc.invalidateQueries({ queryKey: ['profile'] });
      setDefaultAvatarTip('Avatar personalizado guardado correctamente.');
    },
  });

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setPhotoAvatarTip(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ALLOWED.has(f.type)) {
      setFileError('Formato no válido. Usa JPG, PNG o WebP.');
      e.target.value = '';
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError('La imagen no puede superar los 2 MB.');
      e.target.value = '';
      return;
    }
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(f);
    setPendingPreview(URL.createObjectURL(f));
  };

  if (isLoading) return <p className="text-sm text-zinc-500">Cargando perfil…</p>;
  if (error) return <p className="text-sm text-red-400">No se pudo cargar el perfil.</p>;
  if (!data) return <p className="text-sm text-zinc-500">Sin datos de perfil.</p>;

  const hasUploaded = data?.avatar?.type === 'uploaded' && !!data.avatar.url;
  const legacyImageOnly = !data?.avatar && !!data?.avatar_url;
  const showAsUploaded = hasUploaded || legacyImageOnly;

  const field = cn(
    'mt-0.5 w-full rounded-md border px-2 py-1.5 text-[13px] outline-none focus:ring-1 focus:ring-amber-400/30',
    'border-zinc-300 bg-white text-zinc-900',
    'dark:border-white/10 dark:bg-black/30 dark:text-zinc-100',
  );
  const label = 'text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500';

  return (
    <div className="w-full min-w-0 space-y-3">
      <PageHeader title="Cuenta y preferencias" description={data?.email ?? ''} />

      <div className="space-y-3">
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <PanelCard className="min-w-0">
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
        </div>

        <PanelCard className="min-w-0">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Identidad (avatar)</h2>
              <p className="mt-0.5 text-[11px] text-zinc-600 dark:text-zinc-500">Foto subida, o avatar con iniciales. Sin URLs externas.</p>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-2.5 dark:border-white/[0.06] dark:bg-zinc-900/25">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Foto de perfil</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                tabIndex={-1}
                onChange={onPickFile}
              />
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  {pendingPreview && pendingFile ? (
                    <img
                      src={pendingPreview}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg border border-zinc-200 object-cover dark:border-white/10"
                    />
                  ) : data ? (
                    <UserAvatarView user={data} size="lg" className="shrink-0" />
                  ) : null}
                  <div className="min-w-0 text-[11px] text-zinc-500 dark:text-zinc-500">
                    <p>JPG, PNG, WebP · máx. 2 MB</p>
                    <p className="truncate text-zinc-600 dark:text-zinc-400" title={pendingFile?.name ?? ''}>
                      {pendingFile ? pendingFile.name : 'Sin archivo seleccionado.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
                    <button
                      type="button"
                      disabled={uploadAvatarMutation.isPending}
                      className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Elegir archivo
                    </button>
                    {pendingFile && (
                      <>
                        <button
                          type="button"
                          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 disabled:opacity-50"
                          disabled={uploadAvatarMutation.isPending}
                          onClick={() => pendingFile && uploadAvatarMutation.mutate(pendingFile)}
                        >
                          {uploadAvatarMutation.isPending ? 'Guardando…' : 'Guardar imagen'}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 dark:border-white/12 dark:text-zinc-400"
                          onClick={clearPendingFile}
                        >
                          Cancelar
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={deleteAvatarMutation.isPending || (!showAsUploaded && !pendingFile)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 disabled:opacity-40 dark:border-white/12 dark:text-zinc-400"
                      onClick={() => {
                        if (pendingFile) {
                          clearPendingFile();
                          return;
                        }
                        if (showAsUploaded) deleteAvatarMutation.mutate();
                      }}
                    >
                      Quitar imagen
                    </button>
                </div>
              </div>
              {fileError && <p className="mt-2 text-xs text-red-400">{fileError}</p>}
              {uploadAvatarMutation.isError && <p className="mt-2 text-xs text-red-400">{getApiErrorMessage(uploadAvatarMutation.error)}</p>}
              {deleteAvatarMutation.isError && <p className="mt-2 text-xs text-red-400">{getApiErrorMessage(deleteAvatarMutation.error)}</p>}
              {photoAvatarTip && <p className="mt-2 text-xs text-emerald-400/90">{photoAvatarTip}</p>}
            </div>

            <div className="min-w-0">
              <DefaultAvatarEditor
                user={data}
                draft={defaultDraft}
                setDraft={setDefaultDraft}
                preview={buildDefaultPreview(defaultDraft, data)}
                onSave={() => defaultAvatarMutation.mutate(defaultDraft)}
                isPending={defaultAvatarMutation.isPending}
                errorMessage={defaultAvatarMutation.isError ? getApiErrorMessage(defaultAvatarMutation.error) : null}
                successMessage={defaultAvatarTip}
              />
            </div>
          </div>
          <p className="mt-3 border-t border-zinc-200/90 pt-2 text-[10px] leading-relaxed text-zinc-600 dark:border-white/[0.06]">
            Google OAuth: {data?.has_google_linked ? 'vinculado' : 'no vinculado'} · {data?.auth_provider ?? 'LOCAL'}. Servidor <code className="text-zinc-500">/auth/google/*</code> en 501 hasta
            configurar cliente.
          </p>
        </PanelCard>
      </div>
    </div>
  );
}
