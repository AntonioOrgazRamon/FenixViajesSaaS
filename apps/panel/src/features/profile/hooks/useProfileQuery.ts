import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import type { AuthUser } from '../../../store/authStore';
import { profileKeys } from './profileKeys';

export function useProfileQuery() {
  return useQuery<AuthUser>({
    queryKey: profileKeys.all,
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: AuthUser }>('/profile');
      return unwrap(body);
    },
    staleTime: 0,
  });
}
