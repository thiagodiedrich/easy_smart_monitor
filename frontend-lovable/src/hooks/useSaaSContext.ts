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
  
  const initialize = useCallback(async () => {
    await store.initializeContext();
  }, [store]);
  
  return {
    // Current context
    organizationId: store.organizationId,
    workspaceId: store.workspaceId,
    currentOrganization: store.currentOrganization,
    currentWorkspace: store.currentWorkspace,
    
    // Available options
    organizations: store.organizations,
    workspaces: store.workspaces,
    
    // State
    isLoading: store.isLoading,
    isContextReady: store.isContextReady,
    isGlobalAccess: store.organizationId === 0 && store.workspaceId === 0,
    
    // Actions
    selectOrganization,
    selectWorkspace,
    setGlobalAccess,
    initialize,
    fetchOrganizations: store.fetchOrganizations,
    fetchWorkspaces: store.fetchWorkspaces,
  };
}
