import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { useAuthStore, type AuthUser } from '../../../store/authStore';
import { UserAvatarView } from '../../../lib/userAvatarView';
import { DefaultAvatarEditor } from './DefaultAvatarEditor';
import { buildDefaultPreview, type DefaultDraft } from '../defaultAvatarUtils';
import { ProfileSectionCard } from './ProfileSectionCard';
import { profileInputClass, sectionDescriptionClass, sectionTitleClass } from './profileFormStyles';
import { PanelCard } from '../../../components/ui/PanelCard';
import { profileKeys } from '../hooks/profileKeys';
import { cn } from '../../../lib/cn';

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function AvatarSettingsSection({ data, embedded }: { data: AuthUser; embedded?: boolean }) {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
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

  const applyToSession = (p: AuthUser) => {
    const prev = useAuthStore.getState().user;
    if (!prev) return;
    setUser({ ...prev, ...p, avatar: p.avatar, avatar_url: p.avatar_url });
  };

  useEffect(() => {
    if (!data?.avatar) return;
    setDefaultDraft({
      initials: data.avatar.initials?.trim() ?? '',
      backgroundColor: data.avatar.backgroundColor,
      textColor: data.avatar.textColor,
      shape: data.avatar.shape,
    });
  }, [data.id, data.avatar?.backgroundColor, data.avatar?.initials, data.avatar?.shape, data.avatar?.textColor, data.avatar?.type]);

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

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const { data: body } = await api.post<{ success: boolean; data: AuthUser }>('/profile/avatar/upload', fd);
      return unwrap<AuthUser>(body);
    },
    onMutate: () => setPhotoAvatarTip(null),
    onSuccess: (p) => {
      applyToSession(p);
      qc.invalidateQueries({ queryKey: profileKeys.all });
      clearPendingFile();
      setPhotoAvatarTip('Imagen de perfil actualizada correctamente.');
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      const { data: body } = await api.delete<{ success: boolean; data: AuthUser }>('/profile/avatar');
      return unwrap<AuthUser>(body);
    },
    onMutate: () => setPhotoAvatarTip(null),
    onSuccess: (p) => {
      applyToSession(p);
      qc.invalidateQueries({ queryKey: profileKeys.all });
      setPhotoAvatarTip('Imagen eliminada. Ahora se usará el avatar con iniciales.');
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
    onMutate: () => setDefaultAvatarTip(null),
    onSuccess: (p) => {
      applyToSession(p);
      qc.invalidateQueries({ queryKey: profileKeys.all });
      setDefaultAvatarTip('Estilo de avatar por defecto guardado.');
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

  const showAsUploaded = !!((data.avatar?.url ?? '').trim() || (data.avatar_url ?? '').trim());

  const body = (
    <>
      <div className="space-y-3">
        <PanelCard className="!border-dashed" padding="p-3 sm:p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Fotografía de perfil</p>
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
                  alt="Vista previa de la imagen de perfil seleccionada"
                  className="h-14 w-14 shrink-0 rounded-xl border border-zinc-200 object-cover dark:border-white/10"
                />
              ) : (
                <UserAvatarView user={data} size="lg" className="h-14 w-14 min-h-14 min-w-14" />
              )}
              <div className="min-w-0 text-[11px] text-zinc-500">
                <p className="text-zinc-600 dark:text-zinc-400">JPG, PNG, WebP · máx. 2 MB</p>
                <p className="truncate" title={pendingFile?.name ?? ''}>
                  {pendingFile ? pendingFile.name : 'Ningún archivo en cola.'}
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={uploadAvatarMutation.isPending}
                className={cn(
                  profileInputClass,
                  'w-auto border-0 bg-amber-500 py-1.5 font-semibold text-zinc-950 shadow-none hover:bg-amber-400',
                )}
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
                    {uploadAvatarMutation.isPending ? 'Subiendo…' : 'Subir imagen'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs dark:border-white/10"
                    onClick={clearPendingFile}
                  >
                    Cancelar
                  </button>
                </>
              )}
              <button
                type="button"
                disabled={deleteAvatarMutation.isPending || (!showAsUploaded && !pendingFile)}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-40 dark:border-white/10"
                onClick={() => {
                  if (pendingFile) {
                    clearPendingFile();
                    return;
                  }
                  if (showAsUploaded) deleteAvatarMutation.mutate();
                }}
              >
                Quitar foto
              </button>
            </div>
          </div>
          {fileError && <p className="mt-2 text-xs text-red-500">{fileError}</p>}
          {uploadAvatarMutation.isError && (
            <p className="mt-2 text-xs text-red-500">{getApiErrorMessage(uploadAvatarMutation.error)}</p>
          )}
          {deleteAvatarMutation.isError && (
            <p className="mt-2 text-xs text-red-500">{getApiErrorMessage(deleteAvatarMutation.error)}</p>
          )}
          {photoAvatarTip && <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400/90">{photoAvatarTip}</p>}
        </PanelCard>

        <div className="min-w-0">
          <h3 className={sectionTitleClass + ' !mt-0'}>Avatar por defecto (sin foto)</h3>
          <p className={sectionDescriptionClass + ' !mt-0.5'}>Iniciales, color y forma cuando no haya imagen o la quites.</p>
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
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">
        Google: {data.has_google_linked ? 'Cuenta vinculada' : 'No vinculada'} · Proveedor: {data.auth_provider ?? 'LOCAL'}. Vinculación
        en proveedor: pendiente.
      </p>
    </>
  );

  if (embedded) {
    return <div className="min-w-0 space-y-3">{body}</div>;
  }

  return (
    <ProfileSectionCard
      id="avatar"
      title="Identidad visual (avatar)"
      description="Foto o iniciales generadas. Las imágenes se alojan en el servicio; no se aceptan URLs de terceros."
    >
      {body}
    </ProfileSectionCard>
  );
}
