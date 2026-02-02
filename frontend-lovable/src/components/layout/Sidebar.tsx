import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Building2, FolderKanban, Users, Bell, Webhook, Activity, Settings, ChevronLeft, ChevronRight, Cpu, Clock, KeyRound, Gauge, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

const mainNav: NavItem[] = [
  { title: 'Painel de Controle', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Tenants', href: '/tenants', icon: Globe, permission: 'admin.tenants.read' },
  { title: 'Empresas', href: '/organizations', icon: Building2, permission: 'tenant.organizations.read' },
  { title: 'Locais', href: '/workspaces', icon: FolderKanban, permission: 'tenant.workspaces.read' },
  { title: 'Equipamentos', href: '/equipments', icon: Cpu, permission: 'tenant.equipments.read' },
  { title: 'Sensores', href: '/sensors', icon: Gauge, permission: 'tenant.sensors.read' },
  { title: 'Usuários', href: '/users', icon: Users, permission: 'tenant.users.read' },
  { title: 'Alertas', href: '/alerts', icon: Bell, permission: 'tenant.alerts.read' },
  { title: 'Webhooks', href: '/webhooks', icon: Webhook, permission: 'tenant.webhooks.read' },
  { title: 'Relatórios', href: '/analytics', icon: Activity, permission: 'analytics.read' },
  { title: 'Auditoria', href: '/audit-logs', icon: Clock, permission: 'admin.audit.read' },
];

const settingsNav: NavItem[] = [
  { title: 'Planos', href: '/plans', icon: KeyRound, permission: 'admin.plans.read' },
  { title: 'Configurações', href: '/settings', icon: Settings, permission: 'admin.settings.read' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { checkAccess } = usePermissions();
  
  // Filtra os menus baseado nas permissões do usuário
  const filteredMainNav = mainNav.filter((item) => checkAccess(item.permission));
  const filteredSettingsNav = settingsNav.filter((item) => checkAccess(item.permission));

  const NavItemComponent = ({ item, isCollapsed }: { item: NavItem; isCollapsed: boolean }) => {
    const isActive = location.pathname === item.href;
    
    const linkContent = (
      <NavLink
        to={item.href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-sidebar-accent group',
          isActive && 'bg-sidebar-accent text-sidebar-primary',
          !isActive && 'text-sidebar-foreground'
        )}
      >
        <item.icon className={cn(
          'h-5 w-5 flex-shrink-0 transition-colors',
          isActive ? 'text-sidebar-primary' : 'text-sidebar-muted group-hover:text-sidebar-foreground'
        )} />
        <AnimatePresence>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="text-sm font-medium whitespace-nowrap overflow-hidden"
            >
              {item.title}
            </motion.span>
          )}
        </AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="activeNav"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sidebar-primary rounded-r-full"
          />
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      className={cn(
        'fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border',
        'flex flex-col z-40'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sidebar-primary to-accent flex items-center justify-center">
            <Cpu className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden"
              >
                <h1 className="font-semibold text-sidebar-foreground whitespace-nowrap">
                  Easy Monitor
                </h1>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="space-y-1">
          {filteredMainNav.map((item) => (
            <div key={item.href} className="relative">
              <NavItemComponent item={item} isCollapsed={collapsed} />
            </div>
          ))}
        </div>

        <div className="pt-4 mt-4 border-t border-sidebar-border space-y-1">
          {filteredSettingsNav.map((item) => (
            <div key={item.href} className="relative">
              <NavItemComponent item={item} isCollapsed={collapsed} />
            </div>
          ))}
        </div>
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full justify-center text-sidebar-muted hover:text-sidebar-foreground',
            'hover:bg-sidebar-accent'
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span className="text-sm">Recolher</span>
            </>
          )}
        </Button>
      </div>
    </motion.aside>
  );
}
