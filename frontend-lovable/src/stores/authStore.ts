import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginRequest, LoginResponse } from '@/types';
import api from '@/services/api';

interface AuthStore {
  user: User | null;
  permissions: string[];
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  fetchError: boolean;
  error: string | null;
  failedAttempts: number;
  
  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  setTokens: (token: string, refreshToken: string) => void;
  hasPermission: (permission: string) => boolean;
  clearError: () => void;
  resetFailedAttempts: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      permissions: [],
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      fetchError: false,
      error: null,
      failedAttempts: 0,

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null, fetchError: false });
        
        try {
          const response = await api.post<LoginResponse>('/auth/login', credentials);
          const { access_token, refresh_token, user } = response.data;
          
          set({
            user: user || null,
            permissions: user?.permissions || [],
            token: access_token,
            refreshToken: refresh_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            failedAttempts: 0, // Reset on success
          });

          if (!user) {
            await get().fetchUser();
          }
        } catch (error: any) {
          const currentAttempts = (get().failedAttempts || 0) + 1;
          const remaining = Math.max(0, 5 - currentAttempts);
          
          let customMessage = `Credenciais inválidas. Após ${remaining} tentativa${remaining !== 1 ? 's' : ''} seguida${remaining !== 1 ? 's' : ''}, você ficará bloqueado por 30 minutos.`;
          
          if (remaining <= 0) {
            customMessage = 'Usuário bloqueado por 30 minutos devido a múltiplas tentativas falhas.';
          }
          
          if (error.response?.data?.message) {
            const apiMsg = error.response.data.message.toLowerCase();
            if (apiMsg.includes('bloqueado') || apiMsg.includes('muitas tentativas') || apiMsg.includes('lockout')) {
              customMessage = error.response.data.message;
            }
          }
          
          set({
            isLoading: false,
            error: customMessage,
            isAuthenticated: false,
            failedAttempts: currentAttempts,
          });
          
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          permissions: [],
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          failedAttempts: 0,
          fetchError: false,
        });
        
        localStorage.removeItem('saas-context');
      },

      fetchUser: async () => {
        const token = get().token;
        if (!token) return;
        
        set({ isLoading: true, fetchError: false });
        
        try {
          const response = await api.get<User>('/auth/me');
          set({
            user: response.data,
            permissions: response.data?.permissions || [],
            isLoading: false,
            fetchError: false
          });
        } catch (error) {
          console.error('Error fetching user:', error);
          set({ isLoading: false, fetchError: true });
        }
      },

      setTokens: (token: string, refreshToken: string) => {
        set({ token, refreshToken });
      },

      hasPermission: (permission: string) => {
        if (!permission) return true;
        const { permissions } = get();
        if (permissions.includes('*') || permissions.includes(permission)) {
          return true;
        }
        return permissions.some((allowed) => allowed.endsWith('.*') && permission.startsWith(allowed.slice(0, -1)));
      },

      clearError: () => {
        set({ error: null });
      },

      resetFailedAttempts: () => {
        set({ failedAttempts: 0 });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        permissions: state.permissions,
        isAuthenticated: state.isAuthenticated,
        failedAttempts: state.failedAttempts,
      }),
    }
  )
);
