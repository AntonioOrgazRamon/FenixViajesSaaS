import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { unwrap } from '../../../lib/api';
import { profileKeys } from './profileKeys';

export type ProfileActivityItem = {
  id: string;
  action: string;
  result: string;
  ipAddress: string | null;
  userAgent: string | null;
  targetType: string;
  metadata: unknown;
  createdAt: string;
};

export type ProfileActivityResponse = {
  items: ProfileActivityItem[];
  lastPasswordChangeAt: string | null;
};

export function useProfileActivityQuery() {
  return useQuery<ProfileActivityResponse>({
    queryKey: profileKeys.activity,
    queryFn: async () => {
      const { data: body } = await api.get<{ success: boolean; data: ProfileActivityResponse }>('/profile/activity');
      return unwrap(body);
    },
    staleTime: 30_000,
  });
}
