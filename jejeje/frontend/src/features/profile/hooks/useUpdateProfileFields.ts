import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { useAuthStore, type AuthUser, type ProfilePreferencesClient } from '../../../store/authStore';
import { profileKeys } from './profileKeys';
import { writeStoredThemePreference } from '../../../lib/theme';

/** Cuerpo parcial permitido por PATCH /profile (alineado con API). */
export type ProfilePatch = Partial<{
  firstName: string;
  lastName: string;
  displayName: string | null;
  phone: string;
  language: 'es' | 'en';
  timezone: string;
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  timeFormat: '24h' | '12h' | null;
  dateFormat: 'dmy' | 'mdy' | 'ymd' | 'locale' | null;
  profilePreferences: Partial<ProfilePreferencesClient>;
}>;

/**
 * Guardado parcial de campos de perfil (sincroniza Zustand + caché profile).
 */
export function useUpdateProfileFields() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation<AuthUser, Error, ProfilePatch>({
    mutationKey: ['profile', 'patch'],
    mutationFn: async (body) => {
      const { data: bodyRes } = await api.patch<{ success: boolean; data: AuthUser }>('/profile', body);
      return unwrap(bodyRes);
    },
    onSuccess: (data) => {
      const prev = useAuthStore.getState().user;
      if (prev) {
        setUser({
          ...prev,
          ...data,
          avatar: data.avatar,
          avatar_url: data.avatar_url,
        });
      }
      qc.setQueryData(profileKeys.all, data);
      qc.invalidateQueries({ queryKey: profileKeys.activity });
      if (data.theme) writeStoredThemePreference(data.theme);
    },
  });
}

export function humanizeProfileSaveError(err: unknown): string {
  const m = getApiErrorMessage(err);
  if (m) return m;
  return 'No hemos podido guardar los cambios. Revisa la conexión o los datos e inténtalo otra vez.';
}
