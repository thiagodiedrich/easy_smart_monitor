import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Organization, Workspace } from '@/types';
import api from '@/services/api';

interface SaaSStore {
  // Current context
  organizationId: number;
  workspaceId: number;
  
  // Available options
  organizations: Organization[];
  workspaces: Workspace[];
  
  // Selected entities (full objects)
  currentOrganization: Organization | null;
  currentWorkspace: Workspace | null;
  
  // State
  isLoading: boolean;
  isContextReady: boolean;
  error: string | null;
  
  // Computed
  isGlobalAccess: boolean;
  
  // Actions
  fetchOrganizations: () => Promise<void>;
  fetchWorkspaces: (organizationId?: number) => Promise<void>;
  setOrganization: (org: Organization | null) => void;
  setWorkspace: (ws: Workspace | null) => void;
  setContext: (organizationId: number, workspaceId: number) => void;
  resetContext: () => void;
  initializeContext: () => Promise<void>;
}

export const useSaaSStore = create<SaaSStore>()(
  persist(
    (set, get) => ({
      organizationId: 0,
      workspaceId: 0,
      organizations: [],
      workspaces: [],
      currentOrganization: null,
      currentWorkspace: null,
      isLoading: false,
      isContextReady: false,
      error: null,
      
      get isGlobalAccess() {
        const state = get();
        return state.organizationId === 0 && state.workspaceId === 0;
      },

      fetchOrganizations: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.get<Organization[]>('/tenant/organizations');
          const organizations = response.data;
          
          set({ organizations, isLoading: false });
        } catch (error: any) {
          const isForbidden = error?.response?.status === 403;
          console.error('Error fetching organizations:', error);
          
          set({ 
            isLoading: false, 
            // Se for 403, não exibe erro na UI, apenas deixa a lista vazia
            error: isForbidden ? null : 'Erro ao carregar organizações',
            organizations: [] 
          });
        }
      },

      fetchWorkspaces: async (organizationId?: number) => {
        set({ isLoading: true, error: null });
        
        try {
          const orgId = organizationId ?? get().organizationId;
          const params = orgId > 0 ? { organization_id: orgId } : {};
          
          const response = await api.get<Workspace[]>('/tenant/workspaces', { params });
          const workspaces = response.data;
          
          set({ workspaces, isLoading: false });
        } catch (error) {
          console.error('Error fetching workspaces:', error);
          set({ 
            isLoading: false, 
            error: 'Erro ao carregar workspaces',
            workspaces: [] 
          });
        }
      },

      setOrganization: (org: Organization | null) => {
        const newOrgId = org?.id ?? 0;
        
        set({
          currentOrganization: org,
          organizationId: newOrgId,
          // Reset workspace when organization changes
          currentWorkspace: null,
          workspaceId: 0,
          workspaces: [],
        });
        
        // Fetch workspaces for new organization
        if (newOrgId > 0) {
          get().fetchWorkspaces(newOrgId);
        }
      },

      setWorkspace: (ws: Workspace | null) => {
        set({
          currentWorkspace: ws,
          workspaceId: ws?.id ?? 0,
        });
      },

      setContext: (organizationId: number, workspaceId: number) => {
        const { organizations, workspaces } = get();
        
        const org = organizations.find(o => o.id === organizationId) ?? null;
        const ws = workspaces.find(w => w.id === workspaceId) ?? null;
        
        set({
          organizationId,
          workspaceId,
          currentOrganization: org,
          currentWorkspace: ws,
          isContextReady: true,
        });
      },

      resetContext: () => {
        set({
          organizationId: 0,
          workspaceId: 0,
          currentOrganization: null,
          currentWorkspace: null,
        });
      },

      initializeContext: async () => {
        const { isContextReady, isLoading } = get();
        if (isContextReady || isLoading) return;

        set({ isLoading: true, error: null });
        
        try {
          // Fetch organizations first
          await get().fetchOrganizations();
          
          // Check if we have stored context
          const { organizationId, workspaceId, organizations } = get();
          
          if (organizationId > 0) {
            // Find and set the current organization
            const org = organizations.find(o => o.id === organizationId);
            if (org) {
              set({ currentOrganization: org });
              // Fetch workspaces for this organization
              await get().fetchWorkspaces(organizationId);
              
              const { workspaces } = get();
              if (workspaceId > 0) {
                const ws = workspaces.find(w => w.id === workspaceId);
                if (ws) {
                  set({ currentWorkspace: ws });
                }
              }
            }
          }
          
          set({ isContextReady: true, isLoading: false });
        } catch (error: any) {
          console.error('Error initializing context:', error);
          const isForbidden = error?.response?.status === 403;
          set({ 
            isLoading: false, 
            isContextReady: true,
            error: isForbidden ? 'Acesso restrito. Algumas informações podem não estar disponíveis.' : 'Erro ao inicializar contexto'
          });
        }
      },
    }),
    {
      name: 'saas-context',
      partialize: (state) => ({
        organizationId: state.organizationId,
        workspaceId: state.workspaceId,
      }),
    }
  )
);
