import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  KeyRound,
  Shield,
  Settings,
  Filter,
  ChevronDown,
  Loader2,
  Building2,
  Globe,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton-card';
import { useSaaSContext } from '@/hooks/useSaaSContext';
import { useAuthStore } from '@/stores/authStore';
import { PermissionButton } from '@/components/auth/PermissionButton';
import api from '@/services/api';
import type { User, Tenant, Organization } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { devDebug } from '@/lib/logger';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

type StatusOption = 'active' | 'blocked' | 'inactive';

export default function UsersPage() {
  const { organizations, fetchOrganizations, tenants, fetchTenants } = useSaaSContext();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const currentUser = useAuthStore((state) => state.user);
  const canCreate = hasPermission('tenant.users.create');
  const canUpdate = hasPermission('tenant.users.update');
  const canDelete = hasPermission('tenant.users.delete');
  const canUpdatePassword = hasPermission('tenant.users.password');
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusOption[]>(['active', 'blocked']);
  const [isDialogOpen, setIsDialogOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

  const fallbackTenantIds = Array.isArray(currentUser?.tenant_id)
    ? currentUser?.tenant_id
    : currentUser?.tenant_id !== undefined && currentUser?.tenant_id !== null
      ? [Number(currentUser.tenant_id)]
      : [];

  const fallbackTenants: Tenant[] = fallbackTenantIds
    .filter((id) => Number.isFinite(Number(id)) && Number(id) > 0)
    .map((id) => ({
      id: Number(id),
      uuid: String(id),
      name: `Tenant ${id}`,
      slug: `tenant-${id}`,
      plan_code: '',
      status: 'active',
      created_at: '',
      updated_at: '',
    }));

  const tenantOptions = tenants.length > 0 ? tenants : fallbackTenants;
  const hasMultipleTenants = tenantOptions.length > 1;

  // Form state com suporte a múltiplos IDs
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'user',
    status: 'active' as StatusOption,
    tenant_ids: [] as number[],
    organization_ids: [] as number[],
    user_type: 'frontend',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchUsers(),
        fetchOrganizations(),
        fetchTenants()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get<User[]>('/tenant/users');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    }
  };

  const normalizeIds = (value: any): number[] => {
    if (Array.isArray(value)) {
      return value
        .map((item) => Number(item?.id ?? item))
        .filter((id) => Number.isFinite(id));
    }
    if (value === undefined || value === null) return [];
    const id = Number(value?.id ?? value);
    return Number.isFinite(id) ? [id] : [];
  };

  const normalizeRole = (value: any): '' | 'super_user' | 'admin' | 'manager' | 'user' | 'device' => {
    if (!value) return '';
    let raw = '';
    if (typeof value === 'string') {
      raw = value;
    } else if (typeof value === 'object') {
      raw = String((value as any).role ?? (value as any).name ?? '');
    }
    const role = raw.trim().toLowerCase();
    if (role === 'superuser' || role === 'super-user') return 'super_user';
    if (role === 'super_user') return 'super_user';
    if (role === 'admin') return 'admin';
    if (role === 'manager') return 'manager';
    if (role === 'user') return 'user';
    if (role === 'device') return 'device';
    return '';
  };

  const handleOpenDialog = (user?: User) => {
    devDebug('[UsersPage][dialog] open', {
      mode: user ? 'edit' : 'create',
      userId: user?.id,
      rawUser: user,
      tenantOptions,
      fallbackTenantIds,
      formTenantIdsBefore: formData.tenant_ids,
    });
    if (user) {
      setEditingUser(user);
      
      // Normaliza organization_id e tenant_id para arrays de números
      const orgIds = normalizeIds((user as any).organization_ids ?? user.organization_id ?? (user as any).organizations);
      let tenantIds = normalizeIds((user as any).tenant_ids ?? user.tenant_id ?? (user as any).tenants);

      // Fallback: tenta inferir tenant a partir das organizações carregadas
      if (tenantIds.length === 0 && orgIds.length > 0) {
        const inferred = orgIds
          .map((orgId) => organizations.find((o) => o.id === Number(orgId))?.tenant_id)
          .filter((id): id is number => Number.isFinite(Number(id)) && Number(id) > 0);
        if (inferred.length > 0) {
          tenantIds = Array.from(new Set(inferred));
        }
      }

      // Fallback: se só existe um tenant disponível, usa ele
      if (tenantIds.length === 0 && tenantOptions.length === 1) {
        tenantIds = [tenantOptions[0].id];
      }

      devDebug('[UsersPage][dialog] normalized ids', { orgIds, tenantIds });

      // Normaliza role; se desconhecido, deixa em branco
      const roleValue = normalizeRole(user.role);

      setFormData({
        name: user.name || '',
        username: user.username || '',
        email: user.email || '',
        password: '',
        role: roleValue,
        status: (user.status as StatusOption) || 'active',
        tenant_ids: tenantIds,
        organization_ids: orgIds,
        user_type: user.user_type || 'frontend',
      });
      devDebug('[UsersPage][dialog] formData set (edit)', {
        tenant_ids: tenantIds,
        organization_ids: orgIds,
        role: roleValue,
        user_type: user.user_type || 'frontend',
      });
      
      // Carrega as organizações para os tenants do usuário editado
      if (tenantIds.length > 0) {
        tenantIds.forEach(tId => fetchOrganizations(tId));
      }
    } else {
      setEditingUser(null);
      const defaultTenantIds = tenantOptions.length === 1 ? [tenantOptions[0].id] : [];
      setFormData({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'user',
        status: 'active',
        tenant_ids: defaultTenantIds,
        organization_ids: [],
        user_type: 'frontend',
      });
      devDebug('[UsersPage][dialog] formData set (create)', {
        tenant_ids: defaultTenantIds,
      });
      
      if (defaultTenantIds.length > 0) {
        fetchOrganizations(defaultTenantIds[0]);
      }
    }
    setIsDialogOpened(true);
  };

  // Efeito para auto-selecionar empresa se houver apenas uma
  useEffect(() => {
    if (!editingUser && organizations.length === 1 && formData.organization_ids.length === 0 && formData.tenant_ids.length > 0) {
      setFormData(prev => ({ ...prev, organization_ids: [organizations[0].id] }));
    }
  }, [organizations, editingUser, formData.organization_ids, formData.tenant_ids.length]);

  // Efeito para forçar role device se user_type for device
  useEffect(() => {
    if (formData.user_type === 'device') {
      setFormData(prev => ({ ...prev, role: 'device' }));
    } else if (formData.role === 'device' && formData.user_type !== 'device') {
      setFormData(prev => ({ ...prev, role: 'user' }));
    }
  }, [formData.user_type]);

  const toggleTenantSelection = (id: number) => {
    setFormData(prev => {
      const isSelected = prev.tenant_ids.includes(id);
      const newIds = isSelected
        ? prev.tenant_ids.filter(tid => tid !== id)
        : [...prev.tenant_ids, id];
      
      return { ...prev, tenant_ids: newIds, organization_ids: [] };
    });
    
    fetchOrganizations(id);
  };

  const toggleOrgSelection = (id: number) => {
    setFormData(prev => ({
      ...prev,
      organization_ids: prev.organization_ids.includes(id)
        ? prev.organization_ids.filter(oid => oid !== id)
        : [...prev.organization_ids, id]
    }));
  };

  const handleOpenPasswordDialog = (user: User) => {
    if (!canUpdatePassword) {
      toast.error('Você não tem permissão para alterar senha.');
      return;
    }
    setPasswordTarget(user);
    setPasswordValue('');
    setIsPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;
    if (!passwordValue) {
      toast.error('Informe a nova senha.');
      return;
    }
    setIsPasswordSubmitting(true);
    try {
      await api.patch(`/tenant/users/${passwordTarget.id}/password`, { password: passwordValue });
      toast.success('Senha atualizada com sucesso!');
      setIsPasswordDialogOpen(false);
      setPasswordValue('');
      setPasswordTarget(null);
    } catch (error: any) {
      console.error('Error updating password:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Erro ao atualizar senha';
      toast.error(errorMessage);
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser ? !canUpdate : !canCreate) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    
    if (formData.tenant_ids.length === 0) {
      toast.error('Selecione pelo menos um tenant');
      return;
    }

    if (formData.organization_ids.length === 0 && organizations.length > 0) {
      toast.error('Selecione pelo menos uma empresa');
      return;
    }

    if (!formData.role) {
      toast.error('Selecione a função do usuário');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        username: formData.email,
        password: formData.password,
        role: formData.role,
        status: formData.status,
        user_type: formData.user_type,
        tenant_id: formData.tenant_ids.length === 1 ? formData.tenant_ids[0] : formData.tenant_ids,
        organization_id: formData.organization_ids.length === 1 ? formData.organization_ids[0] : formData.organization_ids,
        workspace_id: 0,
      };

      if (editingUser) {
        const updatePayload = { ...payload };
        if (!updatePayload.password) delete (updatePayload as any).password;
        await api.put(`/tenant/users/${editingUser.id}`, updatePayload);
        toast.success('Usuário atualizado com sucesso!');
      } else {
        await api.post('/tenant/users', payload);
        toast.success('Usuário criado com sucesso!');
      }
      setIsDialogOpened(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Erro ao salvar usuário';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canDelete) {
      toast.error('Você não tem permissão para excluir.');
      return;
    }
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      await api.delete(`/tenant/users/${id}`);
      toast.success('Usuário excluído com sucesso!');
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir usuário');
    }
  };

  const toggleStatusFilter = (status: StatusOption) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    const roleName = (typeof user.role === 'object' ? (user.role as any).role : user.role) || '';
    
    const matchesSearch = 
      (user.name?.toLowerCase() || '').includes(searchLower) ||
      (user.username?.toLowerCase() || '').includes(searchLower) ||
      (user.email?.toLowerCase() || '').includes(searchLower) ||
      (String(roleName).toLowerCase()).includes(searchLower) ||
      (user.status?.toLowerCase() || '').includes(searchLower);

    if (selectedStatus.length === 0) return false;
    
    const userStatus = String(user.status || 'active').toLowerCase() as StatusOption;
    const matchesStatus = selectedStatus.includes(userStatus);

    return matchesSearch && matchesStatus;
  });

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    const s = String(status || 'active').toLowerCase();
    switch (s) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inativo</Badge>;
      case 'blocked':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Bloqueado</Badge>;
      default:
        return <Badge variant="outline">{status || '—'}</Badge>;
    }
  };

  const getStatusLabel = (status: StatusOption) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'blocked': return 'Bloqueado';
      case 'inactive': return 'Inativo';
    }
  };

  const getRoleBadge = (role: any) => {
    const roleName = normalizeRole(role);
    if (!roleName) {
      return <span />;
    }

    switch (roleName) {
      case 'super_user':
        return (
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            Super User
          </Badge>
        );
      case 'admin':
        return (
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            Admin
          </Badge>
        );
      case 'manager':
        return <Badge variant="outline">Gerente</Badge>;
      case 'device':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">Device</Badge>;
      case 'user':
        return <Badge variant="outline">Usuário</Badge>;
      default:
        return <span />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Usuários</h1>
            <p className="text-muted-foreground">Gerencie os usuários do tenant</p>
          </div>
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie os usuários do tenant ({users.length})
          </p>
        </div>
        <PermissionButton className="gap-2" onClick={() => handleOpenDialog()} permission="tenant.users.create">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </PermissionButton>
      </motion.div>

      <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, usuário, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="w-full sm:w-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[220px] justify-between font-normal">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span>Status: </span>
                  <div className="flex gap-1 overflow-hidden">
                    {selectedStatus.length === 0 ? (
                      <span className="text-muted-foreground">Nenhum</span>
                    ) : selectedStatus.length === 3 ? (
                      <span>Todos</span>
                    ) : (
                      selectedStatus.map(s => (
                        <Badge key={s} variant="secondary" className="h-5 px-1 text-[10px]">
                          {getStatusLabel(s)}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-2" align="start">
              <div className="space-y-2">
                {(['active', 'blocked', 'inactive'] as StatusOption[]).map((status) => (
                  <div
                    key={status}
                    className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                    onClick={() => toggleStatusFilter(status)}
                  >
                    <Checkbox
                      id={`status-${status}`}
                      checked={selectedStatus.includes(status)}
                      onCheckedChange={() => toggleStatusFilter(status)}
                    />
                    <label
                      htmlFor={`status-${status}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                    >
                      {getStatusLabel(status)}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </motion.div>

      <motion.div variants={item}>
        {filteredUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum usuário encontrado"
            description="Não há usuários correspondentes aos seus filtros."
            action={
              canCreate
                ? { label: 'Adicionar Usuário', onClick: () => handleOpenDialog() }
                : undefined
            }
          />
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Nome</TableHead>
                  <TableHead>Email (Usuário)</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-12 text-center">
                    <Settings className="h-4 w-4 text-muted-foreground mx-auto" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(user.name || '')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name || '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email || '—'}
                    </TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {user.user_type || 'frontend'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        {(() => {
                          const orgId = Array.isArray(user.organization_id) ? user.organization_id[0] : user.organization_id;
                          const org = organizations.find(o => o.id === Number(orgId));
                          return org?.name || '—';
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => handleOpenDialog(user)}
                              disabled={!canUpdate}
                            >
                              <Edit className="h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => handleOpenPasswordDialog(user)}
                              disabled={!canUpdatePassword}
                            >
                              <KeyRound className="h-4 w-4" />
                              Alterar Senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="gap-2 text-destructive focus:text-destructive"
                              onClick={() => handleDelete(user.id)}
                              disabled={!canDelete}
                            >
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpened}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
              <DialogDescription>
                Preencha os dados do usuário abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome Pessoal</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do usuário"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email (Usuário)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
              {!editingUser && (
                <div className="grid gap-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Senha de acesso"
                    required
                  />
                </div>
              )}
              
              {/* Seletor de Tenant (obrigatório) */}
              <div className="grid gap-2">
                <Label>{hasMultipleTenants ? 'Tenants' : 'Tenant'}</Label>
                <Popover>
                  <PopoverTrigger asChild disabled={tenantOptions.length === 0}>
                    <Button variant="outline" className="w-full justify-between font-normal disabled:opacity-50">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div className="flex gap-1 overflow-hidden">
                          {formData.tenant_ids.length === 0 ? (
                            <span className="text-muted-foreground">
                              {tenantOptions.length === 0 ? 'Nenhum tenant disponível' : 'Selecione o tenant'}
                            </span>
                          ) : hasMultipleTenants && formData.tenant_ids.length === tenantOptions.length ? (
                            <span>Todos</span>
                          ) : (
                            formData.tenant_ids.map((id) => (
                              <Badge key={id} variant="secondary" className="h-5 px-1 text-[10px]">
                                {tenantOptions.find((t) => t.id === id)?.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-2" align="start">
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {tenantOptions.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                          onClick={() => toggleTenantSelection(t.id)}
                        >
                          <Checkbox checked={formData.tenant_ids.includes(t.id)} />
                          <span className="text-sm flex-1">{t.name}</span>
                        </div>
                      ))}
                      {tenantOptions.length === 0 && (
                        <p className="text-xs text-center p-4 text-muted-foreground">Nenhum tenant disponível.</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Seletor de Empresa (Multi-seleção) */}
              <div className="grid gap-2">
                <Label>Empresa</Label>
                <Popover>
                  <PopoverTrigger asChild disabled={formData.tenant_ids.length === 0}>
                    <Button variant="outline" className="w-full justify-between font-normal disabled:opacity-50">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div className="flex gap-1 overflow-hidden">
                          {formData.organization_ids.length === 0 ? (
                            <span className="text-muted-foreground">
                              {formData.tenant_ids.length === 0 ? "Escolha um tenant primeiro" : "Selecione as empresas"}
                            </span>
                          ) : formData.organization_ids.length === organizations.length ? (
                            <span>Todas</span>
                          ) : (
                            formData.organization_ids.map(id => (
                              <Badge key={id} variant="secondary" className="h-5 px-1 text-[10px]">
                                {organizations.find(o => o.id === id)?.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-2" align="start">
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {organizations.map((org) => (
                        <div
                          key={org.id}
                          className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer"
                          onClick={() => toggleOrgSelection(org.id)}
                        >
                          <Checkbox checked={formData.organization_ids.includes(org.id)} />
                          <span className="text-sm flex-1">{org.name}</span>
                        </div>
                      ))}
                      {organizations.length === 0 && (
                        <p className="text-xs text-center p-4 text-muted-foreground">Nenhuma empresa encontrada para o tenant selecionado.</p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="user_type">Tipo</Label>
                <Select 
                  value={formData.user_type} 
                  onValueChange={(value) => setFormData({ ...formData, user_type: value })}
                >
                  <SelectTrigger id="user_type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="frontend">Frontend</SelectItem>
                    <SelectItem value="device">Device</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Função</Label>
                <Select 
                  value={formData.role || ""} 
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                  disabled={formData.user_type === 'device'}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_user">Super User</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="device">Device</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="blocked">Bloqueado</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpened(false)}>
                Cancelar
              </Button>
              <PermissionButton
                type="submit"
                disabled={isSubmitting}
                permission={editingUser ? 'tenant.users.update' : 'tenant.users.create'}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
              </PermissionButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handlePasswordSubmit}>
            <DialogHeader>
              <DialogTitle>Alterar Senha</DialogTitle>
              <DialogDescription>
                Defina uma nova senha para o usuário selecionado.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder="Nova senha"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(false)}>
                Cancelar
              </Button>
              <PermissionButton
                type="submit"
                disabled={isPasswordSubmitting}
                permission="tenant.users.password"
              >
                {isPasswordSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </PermissionButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
