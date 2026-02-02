import { useSaaSStore } from '@/stores/saasStore';
import { useCallback } from 'react';
import type { Organization, Workspace } from '@/types';

export function useSaaSContext() {
  const store = useSaaSStore();
  
  const selectOrganization = useCallback((org: Organization | null) => {
    store.setOrganization(org);
  }, [store]);
  
  const selectWorkspace = useCallback((ws: Workspace | null) => {
    store.setWorkspace(ws);
  }, [store]);
  
  const setGlobalAccess = useCallback(() => {
    store.resetContext();
  }, [store]);

  const selectTenant = useCallback((tenant: Tenant | null) => {
    store.setTenant(tenant);
  }, [store]);
  
  const initialize = useCallback(async () => {
    await store.initializeContext();
  }, [store]);
  
  return {
    // Current context
    tenantId: store.tenantId,
    organizationId: store.organizationId,
    workspaceId: store.workspaceId,
    currentTenant: store.currentTenant,
    currentOrganization: store.currentOrganization,
    currentWorkspace: store.currentWorkspace,
    
    // Available options
    tenants: store.tenants,
    organizations: store.organizations,
    workspaces: store.workspaces,
    
    // State
    isLoading: store.isLoading,
    isContextReady: store.isContextReady,
    isGlobalAccess: store.tenantId === 0 && store.organizationId === 0 && store.workspaceId === 0,
    
    // Actions
    selectTenant,
    selectOrganization,
    selectWorkspace,
    setGlobalAccess,
    initialize,
    fetchTenants: store.fetchTenants,
    fetchOrganizations: store.fetchOrganizations,
    fetchWorkspaces: store.fetchWorkspaces,
  };
}
