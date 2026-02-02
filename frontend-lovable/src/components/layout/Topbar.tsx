import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  FolderKanban, 
  ChevronDown, 
  Globe, 
  Check, 
  LogOut, 
  User as UserIcon,
  Bell,
  Search,
  Settings
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSaaSContext } from '@/hooks/useSaaSContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function Topbar() {
  const { user, logout } = useAuth();
  const { 
    tenants,
    organizations, 
    workspaces, 
    tenantId,
    organizationId, 
    workspaceId,
    selectTenant,
    selectOrganization,
    selectWorkspace,
    setGlobalAccess,
    isGlobalAccess,
    fetchTenants
  } = useSaaSContext();

  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);

  const currentTenant = tenants.find(t => t.id === tenantId);
  const currentOrganization = organizations.find(o => o.id === organizationId);
  const currentWorkspace = workspaces.find(w => w.id === workspaceId);

  // Verifica se o usuário tem acesso a múltiplos tenants ou é superuser
  const userTenants = Array.isArray(user?.tenant_id) ? user.tenant_id : [user?.tenant_id];
  const hasMultipleTenants = userTenants.length > 1 || userTenants.includes(0);

  // Se tiver múltiplos tenants e nenhum selecionado (ID 0), traz "Todos Tenants" selecionado
  const showAllTenants = hasMultipleTenants && tenantId === 0;
  // Se tiver múltiplas empresas e nenhuma selecionada, traz "Todas Empresas" selecionado
  const showAllOrgs = organizations.length > 1 && organizationId === 0;
  // Se tiver múltiplos locais e nenhum selecionado, traz "Todos Locais" selecionado
  const showAllWorkspaces = workspaces.length > 1 && workspaceId === 0;

  useEffect(() => {
    if (hasMultipleTenants) {
      fetchTenants();
    }
  }, [hasMultipleTenants, fetchTenants]);

  const handleLogout = () => {
    logout();
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="h-16 bg-topbar border-b border-topbar-border flex items-center justify-between px-6">
      {/* Context Selectors */}
      <div className="flex items-center gap-3">
        {/* Tenant Selector */}
        {hasMultipleTenants && (
          <DropdownMenu open={tenantDropdownOpen} onOpenChange={setTenantDropdownOpen}>
            <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 gap-2 px-3 border-border',
                (currentTenant || showAllTenants) && 'border-primary/50'
              )}
            >
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[150px] truncate text-sm">
                {currentTenant?.name ?? (showAllTenants ? 'Todos Tenants' : 'Todos Tenants')}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Selecione um Tenant
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem
                onClick={() => {
                  selectTenant(null);
                  setTenantDropdownOpen(false);
                }}
                className="gap-2"
              >
                <Globe className="h-4 w-4" />
                <span>Todos Tenants</span>
                {tenantId === 0 && <Check className="h-4 w-4 ml-auto text-primary" />}
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {tenants.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => {
                    selectTenant(t);
                    setTenantDropdownOpen(false);
                  }}
                  className="gap-2"
                >
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{t.name}</span>
                  {tenantId === t.id && (
                    <Check className="h-4 w-4 ml-auto text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Organization Selector */}
        <DropdownMenu open={orgDropdownOpen} onOpenChange={setOrgDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 gap-2 px-3 border-border',
                (currentOrganization || showAllOrgs) && 'border-accent/50'
              )}
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[150px] truncate text-sm">
                {currentOrganization?.name ?? (showAllOrgs ? 'Todas Empresas' : 'Todas Empresas')}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Selecione uma Empresa
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem
              onClick={() => {
                selectOrganization(null);
                setOrgDropdownOpen(false);
              }}
              className="gap-2"
            >
              <Building2 className="h-4 w-4" />
              <span>Todas Empresas</span>
              {organizationId === 0 && <Check className="h-4 w-4 ml-auto text-accent" />}
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => {
                  selectOrganization(org);
                  setOrgDropdownOpen(false);
                }}
                className="gap-2"
              >
                <Building2 className="h-4 w-4" />
                <span className="truncate">{org.name}</span>
                {currentOrganization?.id === org.id && (
                  <Check className="h-4 w-4 ml-auto text-accent" />
                )}
              </DropdownMenuItem>
            ))}
            
            {organizations.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                Nenhuma empresa disponível
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Workspace Selector */}
        <DropdownMenu open={wsDropdownOpen} onOpenChange={setWsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 gap-2 px-3 border-border',
                (currentWorkspace || showAllWorkspaces) && 'border-primary/50'
              )}
              disabled={!currentOrganization && organizationId !== 0}
            >
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[150px] truncate text-sm">
                {currentWorkspace?.name ?? (showAllWorkspaces ? 'Todos Locais' : 'Todos Locais')}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Selecione um Local
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem
              onClick={() => {
                selectWorkspace(null);
                setWsDropdownOpen(false);
              }}
              className="gap-2"
            >
              <FolderKanban className="h-4 w-4" />
              <span>Todos Locais</span>
              {workspaceId === 0 && <Check className="h-4 w-4 ml-auto text-primary" />}
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            {workspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => {
                  selectWorkspace(ws);
                  setWsDropdownOpen(false);
                }}
                className="gap-2"
              >
                <FolderKanban className="h-4 w-4" />
                <span className="truncate">{ws.name}</span>
                {currentWorkspace?.id === ws.id && (
                  <Check className="h-4 w-4 ml-auto text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            
            {workspaces.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                Nenhum local disponível
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* User Actions */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-topbar" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-3 px-2 hover:bg-muted/50">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-sm font-medium leading-none">{user?.name}</span>
                <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
              </div>
              <Avatar className="h-9 w-9 border border-border">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getInitials(user?.name || '')}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => window.location.href = '/profile'}>
              <UserIcon className="h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => window.location.href = '/settings'}>
              <Settings className="h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive cursor-pointer" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
