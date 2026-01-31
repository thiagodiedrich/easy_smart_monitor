import { useAuthStore } from '@/stores/authStore';
import { useCallback } from 'react';

export function useAuth() {
  const store = useAuthStore();
  
  const login = useCallback(async (username: string, password: string) => {
    await store.login({ username, password });
  }, [store]);
  
  const logout = useCallback(() => {
    store.logout();
  }, [store]);
  
  return {
    user: store.user,
    token: store.token,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    login,
    logout,
    fetchUser: store.fetchUser,
    clearError: store.clearError,
  };
}
