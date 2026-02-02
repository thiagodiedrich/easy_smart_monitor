import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/stores/authStore';

interface PermissionRouteProps {
  permission?: string;
  children: React.ReactNode;
}

export function PermissionRoute({ permission, children }: PermissionRouteProps) {
  const authLoading = useAuthStore((state) => state.isLoading);
  const { checkAccess } = usePermissions();

  if (authLoading) {
    return null;
  }

  if (permission && !checkAccess(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
