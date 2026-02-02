import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tenant, Organization, Workspace } from '@/types';
import api from '@/services/api';
import { useAuthStore } from '@/stores/authStore';

interface SaaSStore {
  // Current context
  tenantId: number;
  organizationId: number;
  workspaceId: number;
  
  // Available options
  tenants: Tenant[];
  organizations: Organization[];
  workspaces: Workspace[];
  
  // Selected entities (full objects)
  currentTenant: Tenant | null;
  currentOrganization: Organization | null;
  currentWorkspace: Workspace | null;
  
  // State
  isLoading: boolean;
  isContextReady: boolean;
  error: string | null;
  
  // Computed
  isGlobalAccess: boolean;
  
  // Actions
  fetchTenants: () => Promise<void>;
  fetchOrganizations: (tenantId?: number) => Promise<Organization[]>;
  fetchWorkspaces: (organizationId?: number) => Promise<Workspace[]>;
  setTenant: (tenant: Tenant | null) => Promise<void>;
  setOrganization: (org: Organization | null) => Promise<void>;
  setWorkspace: (ws: Workspace | null) => void;
  setContext: (tenantId: number, organizationId: number, workspaceId: number) => void;
  resetContext: () => void;
  initializeContext: () => Promise<void>;
}

export const useSaaSStore = create<SaaSStore>()(
  persist(
    (set, get) => ({
      tenantId: 0,
      organizationId: 0,
      workspaceId: 0,
      tenants: [],
      organizations: [],
      workspaces: [],
      currentTenant: null,
      currentOrganization: null,
      currentWorkspace: null,
      isLoading: false,
      isContextReady: false,
      error: null,
      
      get isGlobalAccess() {
        const state = get();
        return state.tenantId === 0 && state.organizationId === 0 && state.workspaceId === 0;
      },

      fetchTenants: async () => {
        // Verifica se o usuário tem permissão para ler tenants ou é superuser (tenant 0)
        const { user, hasPermission } = useAuthStore.getState();
        const userTenants = Array.isArray(user?.tenant_id) ? user.tenant_id : [user?.tenant_id];
        const isSuper = userTenants.includes(0);
        
        if (!isSuper && !hasPermission('admin.tenants.read')) {
          set({ tenants: [], isLoading: false });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const response = await api.get<Tenant[]>('/admin/tenants');
          set({ tenants: response.data || [], isLoading: false });
        } catch (error: any) {
          console.error('Error fetching tenants:', error);
          set({ isLoading: false, tenants: [] });
        }
      },

      fetchOrganizations: async (tenantId?: number) => {
        set({ isLoading: true, error: null });
        try {
          const tId = tenantId ?? get().tenantId;
          const params = tId > 0 ? { tenant_id: tId } : {};
          const response = await api.get<Organization[]>('/tenant/organizations', { params });
          const organizations = response.data || [];
          set({ organizations, isLoading: false });
          return organizations;
        } catch (error: any) {
          console.error('Error fetching organizations:', error);
          set({ isLoading: false, organizations: [] });
          return [];
        }
      },

      fetchWorkspaces: async (organizationId?: number) => {
        set({ isLoading: true, error: null });
        try {
          const orgId = organizationId ?? get().organizationId;
          const params = orgId > 0 ? { organization_id: orgId } : {};
          const response = await api.get<Workspace[]>('/tenant/workspaces', { params });
          const workspaces = response.data || [];
          set({ workspaces, isLoading: false });
          return workspaces;
        } catch (error) {
          console.error('Error fetching workspaces:', error);
          set({ isLoading: false, workspaces: [] });
          return [];
        }
      },

      setTenant: async (tenant: Tenant | null) => {
        const newTenantId = tenant?.id ?? 0;
        set({
          currentTenant: tenant,
          tenantId: newTenantId,
          currentOrganization: null,
          organizationId: 0,
          organizations: [],
          currentWorkspace: null,
          workspaceId: 0,
          workspaces: [],
        });
        
        const orgs = await get().fetchOrganizations(newTenantId);
        if (orgs.length === 1) {
          // Se tiver só uma, seleciona ela automaticamente
          await get().setOrganization(orgs[0]);
        } else {
          // Se tiver múltiplas ou nenhuma, mantém "Todas Empresas" (ID 0)
          set({ organizationId: 0, currentOrganization: null });
          // Busca locais globais para o tenant
          await get().fetchWorkspaces(0);
        }
      },

      setOrganization: async (org: Organization | null) => {
        const newOrgId = org?.id ?? 0;
        set({
          currentOrganization: org,
          organizationId: newOrgId,
          currentWorkspace: null,
          workspaceId: 0,
          workspaces: [],
        });
        
        const wss = await get().fetchWorkspaces(newOrgId);
        if (wss.length === 1) {
          // Se tiver só um, seleciona ele automaticamente
          get().setWorkspace(wss[0]);
        } else {
          // Se tiver múltiplos ou nenhum, mantém "Todos Locais" (ID 0)
          set({ workspaceId: 0, currentWorkspace: null });
        }
      },

      setWorkspace: (ws: Workspace | null) => {
        set({
          currentWorkspace: ws,
          workspaceId: ws?.id ?? 0,
        });
      },

      setContext: (tenantId: number, organizationId: number, workspaceId: number) => {
        const { tenants, organizations, workspaces } = get();
        set({
          tenantId,
          organizationId,
          workspaceId,
          currentTenant: tenants.find(t => t.id === tenantId) ?? null,
          currentOrganization: organizations.find(o => o.id === organizationId) ?? null,
          currentWorkspace: workspaces.find(w => w.id === workspaceId) ?? null,
          isContextReady: true,
        });
      },

      resetContext: () => {
        set({
          tenantId: 0,
          organizationId: 0,
          workspaceId: 0,
          currentTenant: null,
          currentOrganization: null,
          currentWorkspace: null,
        });
      },

      initializeContext: async () => {
        const { isContextReady, isLoading } = get();
        if (isContextReady || isLoading) return;

        set({ isLoading: true, error: null });
        
        try {
          // 1. Carrega Tenants
          await get().fetchTenants();
          const { tenants, tenantId: storedTenantId } = get();
          
          // Se tiver múltiplos tenants, mantém "Todos Tenants" (ID 0) selecionado por padrão
          // Se tiver apenas um, seleciona ele
          if (storedTenantId === 0 && tenants.length === 1) {
            await get().setTenant(tenants[0]);
          } else if (storedTenantId > 0) {
            const t = tenants.find(t => t.id === storedTenantId);
            if (t) set({ currentTenant: t });
          } else {
            // Garante que "Todos Tenants" (ID 0) seja o padrão se houver mais de um
            set({ tenantId: 0, currentTenant: null });
          }

          // 2. Carrega Empresas
          const orgs = await get().fetchOrganizations(get().tenantId);
          const { organizationId: storedOrgId } = get();

          // Se tiver múltiplas empresas, mantém "Todas Empresas" (ID 0) selecionado por padrão
          if (storedOrgId === 0 && orgs.length === 1) {
            await get().setOrganization(orgs[0]);
          } else if (storedOrgId > 0) {
            const o = orgs.find(o => o.id === storedOrgId);
            if (o) set({ currentOrganization: o });
          } else {
            // Garante que "Todas Empresas" (ID 0) seja o padrão se houver mais de uma
            set({ organizationId: 0, currentOrganization: null });
          }

          // 3. Carrega Locais
          const wss = await get().fetchWorkspaces(get().organizationId);
          const { workspaceId: storedWsId } = get();

          // Se tiver múltiplos locais, mantém "Todos Locais" (ID 0) selecionado por padrão
          if (storedWsId === 0 && wss.length === 1) {
            get().setWorkspace(wss[0]);
          } else if (storedWsId > 0) {
            const w = wss.find(w => w.id === storedWsId);
            if (w) set({ currentWorkspace: w });
          } else {
            // Garante que "Todos Locais" (ID 0) seja o padrão se houver mais de um
            set({ workspaceId: 0, currentWorkspace: null });
          }
          
          set({ isContextReady: true, isLoading: false });
        } catch (error: any) {
          console.error('Error initializing context:', error);
          set({ isLoading: false, isContextReady: true });
        }
      },
    }),
    {
      name: 'saas-context',
      partialize: (state) => ({
        tenantId: state.tenantId,
        organizationId: state.organizationId,
        workspaceId: state.workspaceId,
      }),
    }
  )
);
