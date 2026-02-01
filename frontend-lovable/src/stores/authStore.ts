import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, LoginRequest, LoginResponse } from '@/types';
import api from '@/services/api';

interface AuthStore {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  failedAttempts: number;
  
  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  setTokens: (token: string, refreshToken: string) => void;
  clearError: () => void;
  resetFailedAttempts: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      failedAttempts: 0,

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.post<LoginResponse>('/auth/login', credentials);
          const { access_token, refresh_token, user } = response.data;
          
          set({
            user,
            token: access_token,
            refreshToken: refresh_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            failedAttempts: 0, // Reset on success
          });
        } catch (error: any) {
          const currentAttempts = (get().failedAttempts || 0) + 1;
          const remaining = Math.max(0, 5 - currentAttempts);
          
          let customMessage = `Credenciais inválidas. Após ${remaining} tentativa${remaining !== 1 ? 's' : ''} seguida${remaining !== 1 ? 's' : ''}, você ficará bloqueado por 30 minutos.`;
          
          if (remaining <= 0) {
            customMessage = 'Usuário bloqueado por 30 minutos devido a múltiplas tentativas falhas.';
          }
          
          // Se a API trouxer uma mensagem específica de bloqueio real, respeitamos ela
          if (error.response?.data?.message) {
            const apiMsg = error.response.data.message.toLowerCase();
            if (apiMsg.includes('bloqueado') || apiMsg.includes('muitas tentativas') || apiMsg.includes('lockout')) {
              customMessage = error.response.data.message;
            }
          }
          
          console.log('Failed attempt:', currentAttempts, 'Message:', customMessage);
          
          // Forçamos o estado a atualizar com a nossa mensagem
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
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          failedAttempts: 0,
        });
        
        // Clear SaaS context on logout
        localStorage.removeItem('saas-context');
      },

      fetchUser: async () => {
        const token = get().token;
        if (!token) return;
        
        set({ isLoading: true });
        
        try {
          const response = await api.get<User>('/auth/me');
          set({ user: response.data, isLoading: false });
        } catch (error) {
          console.error('Error fetching user:', error);
          set({ isLoading: false });
        }
      },

      setTokens: (token: string, refreshToken: string) => {
        set({ token, refreshToken });
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
        isAuthenticated: state.isAuthenticated,
        failedAttempts: state.failedAttempts,
      }),
    }
  )
);
