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
  
  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  setTokens: (token: string, refreshToken: string) => void;
  clearError: () => void;
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
          });
        } catch (error: any) {
          let message = 'Erro ao fazer login. Verifique suas credenciais.';
          
          if (error.response?.data?.message) {
            message = error.response.data.message;
          } else if (error.message) {
            message = error.message;
          }
          
          set({
            isLoading: false,
            error: message,
            isAuthenticated: false,
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
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
