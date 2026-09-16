import { getGetCurrentUserQueryKey, useGetCurrentUser } from '@workspace/api-client-react';

export function useAuth() {
  const { data, isLoading } = useGetCurrentUser({ query: { retry: false, queryKey: getGetCurrentUserQueryKey() } });
  return { user: data ?? null, isAuthenticated: Boolean(data), isLoading };
}
