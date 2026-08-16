import { useCallback, useMemo } from "react";
import { trpc } from "../lib/trpc";
import { startLogin } from "../auth";

export function useAuth() {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    await utils.auth.me.invalidate();
  }, [logoutMutation, utils]);

  return useMemo(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
      login: startLogin,
      logout,
    }),
    [meQuery.data, meQuery.error, meQuery.isLoading, logout, logoutMutation.error, logoutMutation.isPending],
  );
}
