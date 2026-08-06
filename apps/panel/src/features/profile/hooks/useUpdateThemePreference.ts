import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { getApiErrorMessage } from '../../../lib/errors';
import { writeStoredThemePreference, type ThemePreference } from '../../../lib/theme';
import { useAuthStore, type AuthUser } from '../../../store/authStore';
import { profileKeys } from './profileKeys';

type Ctx = { previousUser: AuthUser | null; previousProfile: AuthUser | undefined };

/**
 * Tema: mismo flujo en sidebar y en Cuenta (optimistic + revierte si el PATCH falla).
 */
export function useUpdateThemePreference() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation<AuthUser, Error, ThemePreference, Ctx | undefined>({
    mutationKey: ['profile', 'theme'],
    mutationFn: async (theme) => {
      const { data: body } = await api.patch<{ success: boolean; data: AuthUser }>('/profile', { theme });
      return unwrap(body);
    },
    onMutate: async (theme) => {
      await qc.cancelQueries({ queryKey: profileKeys.all });
      const previousUser = useAuthStore.getState().user;
      const previousProfile = qc.getQueryData<AuthUser>(profileKeys.all);
      if (previousUser) {
        setUser({ ...previousUser, theme });
      }
      writeStoredThemePreference(theme);
      if (previousProfile) {
        qc.setQueryData(profileKeys.all, { ...previousProfile, theme });
      }
      return { previousUser, previousProfile };
    },
    onError: (_err, _theme, context) => {
      if (context?.previousUser) setUser(context.previousUser);
      if (context?.previousProfile !== undefined) {
        qc.setQueryData(profileKeys.all, context.previousProfile);
      }
    },
    onSuccess: (data) => {
      const t = data.theme ?? 'SYSTEM';
      writeStoredThemePreference(t);
      const prev = useAuthStore.getState().user;
      if (prev) {
        setUser({
          ...prev,
          ...data,
          avatar: data.avatar,
          avatar_url: data.avatar_url,
        });
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}

export function getThemeUpdateErrorMessage(err: unknown): string {
  const m = getApiErrorMessage(err);
  if (m && !/^Error\b/i.test(m) && m.length < 200) {
    return `No hemos podido guardar el tema. ${m}`;
  }
  return 'No hemos podido guardar el tema. Revisa tu conexión e inténtalo de nuevo.';
}
