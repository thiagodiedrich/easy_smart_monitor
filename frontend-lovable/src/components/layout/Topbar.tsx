import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  FolderKanban,
  ChevronDown,
  User,
  LogOut,
  Globe,
  Check,
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function Topbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    currentOrganization,
    currentWorkspace,
    organizations,
    workspaces,
    isGlobalAccess,
    selectOrganization,
    selectWorkspace,
    setGlobalAccess,
  } = useSaaSContext();

  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name: string) => {
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
        {/* Organization Selector */}
        <DropdownMenu open={orgDropdownOpen} onOpenChange={setOrgDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'h-9 gap-2 px-3 border-border',
                currentOrganization && 'border-accent/50'
              )}
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[150px] truncate text-sm">
                {currentOrganization?.name ?? 'Todas Organizations'}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Selecione uma Organization
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            <DropdownMenuItem
              onClick={() => {
                setGlobalAccess();
                setOrgDropdownOpen(false);
              }}
              className="gap-2"
            >
              <Globe className="h-4 w-4" />
              <span>Acesso Global</span>
              {isGlobalAccess && <Check className="h-4 w-4 ml-auto text-accent" />}
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
                Nenhuma organization disponível
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
                currentWorkspace && 'border-accent/50'
              )}
              disabled={!currentOrganization}
            >
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[150px] truncate text-sm">
                {currentWorkspace?.name ?? 'Todos Workspaces'}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              Selecione um Workspace
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
              <span>Todos Workspaces</span>
              {!currentWorkspace && currentOrganization && (
                <Check className="h-4 w-4 ml-auto text-accent" />
              )}
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
                  <Check className="h-4 w-4 ml-auto text-accent" />
                )}
              </DropdownMenuItem>
            ))}
            
            {workspaces.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                Nenhum workspace disponível
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Context Badge */}
        {isGlobalAccess && (
          <Badge variant="outline" className="h-6 gap-1 text-xs font-normal">
            <Globe className="h-3 w-3" />
            Acesso Global
          </Badge>
        )}
      </div>

      {/* User Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {user?.name ? getInitials(user.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium hidden md:inline">
              {user?.name ?? 'Usuário'}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2">
            <User className="h-4 w-4" />
            Meu Perfil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
