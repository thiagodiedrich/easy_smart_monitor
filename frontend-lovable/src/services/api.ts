import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { useSaaSStore } from '@/stores/saasStore';

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://easy.simc.com.br/api/v1';
const IS_DEV = import.meta.env.VITE_MODE === 'development' || import.meta.env.DEV;

// Create Axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Attach JWT and SaaS context
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from store
    const token = useAuthStore.getState().token;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach SaaS context headers
    const { organizationId, workspaceId } = useSaaSStore.getState();
    
    if (organizationId !== null && organizationId > 0) {
      config.headers['X-Organization-ID'] = organizationId.toString();
    }
    
    if (workspaceId !== null && workspaceId > 0) {
      config.headers['X-Workspace-ID'] = workspaceId.toString();
    }

    if (IS_DEV) {
      const { method, url, params, data, headers } = config;
      const safeHeaders = { ...headers };
      if (safeHeaders.Authorization) {
        safeHeaders.Authorization = 'Bearer [redacted]';
      }
      console.debug('[API][request]', {
        method,
        url,
        params,
        data,
        headers: safeHeaders,
      });
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => {
    if (IS_DEV) {
      console.debug('[API][response]', {
        status: response.status,
        url: response.config?.url,
        data: response.data,
      });
    }
    return response;
  },
  async (error: AxiosError) => {
    if (IS_DEV) {
      console.debug('[API][error]', {
        status: error.response?.status,
        url: error.config?.url,
        data: error.response?.data,
      });
    }
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - Unauthorized
    if (error.response?.status === 401) {
      // Try to refresh token
      const refreshToken = useAuthStore.getState().refreshToken;
      
      if (refreshToken && !originalRequest._retry) {
        originalRequest._retry = true;
        
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          
          const { access_token, refresh_token } = response.data;
          
          // Update tokens in store
          useAuthStore.getState().setTokens(access_token, refresh_token);
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed - logout user
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
      
      // No refresh token or retry failed - logout
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }

    // Handle 403 - Forbidden
    if (error.response?.status === 403) {
      console.error('Access forbidden:', error.response.data);
      // Could redirect to an access denied page
    }

    return Promise.reject(error);
  }
);

export default api;
