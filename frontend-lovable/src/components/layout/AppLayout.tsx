import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/hooks/useAuth';
import { useSaaSContext } from '@/hooks/useSaaSContext';
import { Skeleton } from '@/components/ui/skeleton';

export function AppLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isContextReady, initialize } = useSaaSContext();
  const [sidebarWidth, setSidebarWidth] = useState(256);

  // Check auth and redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Initialize SaaS context when authenticated
  useEffect(() => {
    if (isAuthenticated && !isContextReady) {
      initialize();
    }
  }, [isAuthenticated, isContextReady, initialize]);

  // Loading state
  if (authLoading || !isContextReady) {
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
