import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/hooks/useAuth';
import { useSaaSContext } from '@/hooks/useSaaSContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, RefreshCcw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';

export function AppLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, user, fetchUser, logout } = useAuth();
  const fetchError = useAuthStore((state) => state.fetchError);
  const { isContextReady, initialize, tenantId, organizationId, workspaceId, error: contextError } = useSaaSContext();
  const { permissions } = usePermissions();
  const [sidebarWidth, setSidebarWidth] = useState(256);

  // Check auth and redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Initialize SaaS context and fetch user data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Garante que temos os dados do usuário e permissões
      if (!user && !fetchError && !authLoading) {
        fetchUser();
      }
      // Inicializa o contexto SaaS (Tenants, Orgs, Workspaces)
      if (!isContextReady && !contextError) {
        initialize();
      }
    }
  }, [isAuthenticated, isContextReady, initialize, user, fetchError, authLoading, fetchUser, contextError]);

  // Error state for profile fetch failure
  if (fetchError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="flex justify-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Erro ao carregar perfil</h1>
          <p className="text-muted-foreground">Não foi possível carregar os dados do seu usuário. Isso pode ser um erro temporário no servidor.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Tentar Novamente
            </Button>
            <Button onClick={() => logout()} variant="outline" className="gap-2">
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Error state for context initialization
  if (contextError && !isContextReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="flex justify-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <h1 className="text-xl font-bold">Erro ao carregar contexto</h1>
          <p className="text-muted-foreground">{contextError}</p>
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  // Loading state - Aguarda autenticação, contexto E permissões
  const isAppLoading = authLoading || (!isContextReady && !contextError) || (!user && !fetchError);

  if (isAppLoading) {
    return (
      <div className="min-h-screen flex">
        {/* Sidebar skeleton */}
        <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border p-4">
          <div className="flex items-center gap-3 mb-8">
            <Skeleton className="h-9 w-9 rounded-lg bg-sidebar-accent" />
            <Skeleton className="h-5 w-28 bg-sidebar-accent" />
          </div>
          <div className="space-y-2">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg bg-sidebar-accent" />
            ))}
          </div>
        </div>
        
        {/* Main content skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="h-16 border-b border-border px-6 flex items-center justify-between">
            <div className="flex gap-3">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-40" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="flex-1 p-6">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      
      <motion.div
        className="flex-1 flex flex-col min-h-screen"
        initial={{ marginLeft: 256 }}
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2 }}
        style={{ marginLeft: 256 }} // Default margin matching sidebar
      >
        <Topbar />
        
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </motion.div>
    </div>
  );
}
