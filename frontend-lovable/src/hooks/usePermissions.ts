import { useAuthStore } from "@/stores/authStore";
import { useCallback } from "react";

export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);
  const hasPermission = useAuthStore((state) => state.hasPermission);

  const checkAccess = useCallback((permission?: string) => {
    // Se não houver permissão exigida, o acesso é livre
    if (!permission) return true;

    // Se o usuário não estiver logado, não tem acesso
    if (!user) return false;

    // Se for superuser (tenant_id inclui 0), tem acesso total (*)
    const userTenants = Array.isArray(user.tenant_id) ? user.tenant_id : [user.tenant_id];
    if (userTenants.includes(0)) return true;

    // Verifica a permissão específica
    return hasPermission(permission);
  }, [user, hasPermission]);

  return {
    checkAccess,
    userRole: typeof user?.role === 'string' ? user.role : (user?.role as any)?.role,
    isSuperUser: (Array.isArray(user?.tenant_id) ? user.tenant_id : [user?.tenant_id]).includes(0),
    permissions,
  };
}
