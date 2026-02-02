import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Filter,
  ChevronDown,
  Settings,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton-card';
import { useSaaSContext } from '@/hooks/useSaaSContext';
import { useAuthStore } from '@/stores/authStore';
import { PermissionButton } from '@/components/auth/PermissionButton';
import api from '@/services/api';
import type { Organization } from '@/types';
import { toast } from 'sonner';
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

export default function OrganizationsPage() {
  const { organizations, isLoading, fetchOrganizations, tenants, fetchTenants } = useSaaSContext();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const currentUser = useAuthStore((state) => state.user);
  const canCreate = hasPermission('tenant.organizations.create');
  const canUpdate = hasPermission('tenant.organizations.update');
  const canDelete = hasPermission('tenant.organizations.delete');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusOption[]>(['active', 'blocked']);
  const [isDialogOpen, setIsDialogOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  
  const fallbackTenantIds = Array.isArray(currentUser?.tenant_id)
    ? currentUser?.tenant_id
    : currentUser?.tenant_id !== undefined && currentUser?.tenant_id !== null
      ? [Number(currentUser.tenant_id)]
      : [];

  const fallbackTenants = fallbackTenantIds
    .filter((id) => Number.isFinite(Number(id)) && Number(id) > 0)
    .map((id) => ({
      id: Number(id),
      uuid: String(id),
      name: `Tenant ${id}`,
      slug: `tenant-${id}`,
      plan_code: '',
      status: 'active' as const,
      created_at: '',
      updated_at: '',
    }));

  const tenantOptions = tenants.length > 0 ? tenants : fallbackTenants;
  const hasMultipleTenants = tenantOptions.length > 1;
  const isSuperUser = (() => {
    const role = currentUser?.role as any;
    if (Array.isArray(role)) return role.includes(0) || role.includes('0');
    if (role && typeof role === 'object') return role[0] === true || role['0'] === true || role.super === true;
    return false;
  })();
  const resolveTenantId = () => {
    if (formData.tenant_id === 0 && isSuperUser) return 0;
    if (formData.tenant_id > 0) return formData.tenant_id;
    if (tenantOptions.length === 1) return tenantOptions[0].id;
    if (fallbackTenantIds.length === 1 && fallbackTenantIds[0] > 0) return fallbackTenantIds[0];
    return null;
  };

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
    status: 'active' as StatusOption,
    tenant_id: -1,
  });

  useEffect(() => {
    fetchOrganizations();
    fetchTenants();
  }, []);

  useEffect(() => {
    if (formData.tenant_id === -1 && tenantOptions.length === 1) {
      setFormData((prev) => ({ ...prev, tenant_id: tenantOptions[0].id }));
    }
  }, [tenantOptions, formData.tenant_id]);

  const toggleStatus = (status: StatusOption) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const filteredOrganizations = organizations.filter((org) => {
    // 1. Filtro de Busca
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (org.name?.toLowerCase() || '').includes(searchLower) ||
      (org.email?.toLowerCase() || '').includes(searchLower) ||
      (org.phone?.toLowerCase() || '').includes(searchLower) ||
      (org.document?.toLowerCase() || '').includes(searchLower) ||
      (org.status?.toLowerCase() || '').includes(searchLower);

    // 2. Filtro de Status (ListBox Multi-seleção)
    if (selectedStatus.length === 0) return false;
    const matchesStatus = selectedStatus.includes(org.status as StatusOption);

    return matchesSearch && matchesStatus;
  });

  const handleOpenDialog = (org?: Organization) => {
    if (org) {
      setEditingOrg(org);
      setFormData({
        name: org.name || '',
        email: org.email || '',
        phone: org.phone || '',
        document: org.document || '',
        status: (org.status as StatusOption) || 'active',
        tenant_id: org.tenant_id || (tenantOptions.length === 1 ? tenantOptions[0].id : (fallbackTenantIds.length === 1 ? fallbackTenantIds[0] : -1)),
      });
    } else {
      setEditingOrg(null);
      // Se tiver apenas um tenant, já seleciona ele
      const defaultTenantId = tenantOptions.length === 1 ? tenantOptions[0].id : (fallbackTenantIds.length === 1 ? fallbackTenantIds[0] : -1);
      setFormData({
        name: '',
        email: '',
        phone: '',
        document: '',
        status: 'active',
        tenant_id: defaultTenantId,
      });
    }
    setIsDialogOpened(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingOrg ? !canUpdate : !canCreate) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }

    const resolvedTenantId = resolveTenantId();
    if (resolvedTenantId === null) {
      toast.error('Selecione um tenant');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        tenant_id: resolvedTenantId,
      };
      devDebug('[OrganizationsPage][submit]', {
        editing: Boolean(editingOrg),
        formTenantId: formData.tenant_id,
        resolvedTenantId,
        tenantOptions,
      });

      if (editingOrg) {
        await api.put(`/tenant/organizations/${editingOrg.id}`, payload);
        toast.success('Empresa atualizada com sucesso!');
      } else {
        await api.post('/tenant/organizations', payload);
        toast.success('Empresa e usuário administrador criados com sucesso!');
      }
      setIsDialogOpened(false);
      fetchOrganizations();
    } catch (error: any) {
      console.error('Error saving organization:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Erro ao salvar empresa';
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
    if (!confirm('Tem certeza que deseja excluir esta empresa?')) return;

    try {
      await api.delete(`/tenant/organizations/${id}`);
      toast.success('Empresa excluída com sucesso!');
      fetchOrganizations();
    } catch (error: any) {
      console.error('Error deleting organization:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Erro ao excluir empresa';
      toast.error(errorMessage);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inativo</Badge>;
      case 'blocked':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Bloqueado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusLabel = (status: StatusOption) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'blocked': return 'Bloqueado';
      case 'inactive': return 'Inativo';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Empresas</h1>
            <p className="text-muted-foreground">Gerencie suas empresas</p>
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
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-muted-foreground">
            Gerencie suas empresas ({organizations.length})
          </p>
        </div>
        <PermissionButton
          className="gap-2"
          onClick={() => handleOpenDialog()}
          permission="tenant.organizations.create"
        >
          <Plus className="h-4 w-4" />
          Nova Empresa
        </PermissionButton>
      </motion.div>

      {/* Search and Filter */}
      <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email, tel, doc..."
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
                    onClick={() => toggleStatus(status)}
                  >
                    <Checkbox
                      id={`status-${status}`}
                      checked={selectedStatus.includes(status)}
                      onCheckedChange={() => toggleStatus(status)}
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

      {/* Table */}
      <motion.div variants={item}>
        {filteredOrganizations.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhuma empresa encontrada"
            description="Não há empresas correspondentes aos seus filtros ou você ainda não criou nenhuma."
            action={
              canCreate
                ? { label: 'Criar Empresa', onClick: () => handleOpenDialog() }
                : undefined
            }
          />
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12 text-center">
                    <Settings className="h-4 w-4 text-muted-foreground mx-auto" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizations.map((org) => (
                  <TableRow key={org.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-accent" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{org.name}</span>
                          {org.document && <span className="text-[10px] text-muted-foreground">{org.document}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {org.email || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {org.phone || '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {org.created_at ? new Date(org.created_at).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(org.status)}</TableCell>
                    <TableCell>
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
                            onClick={() => handleOpenDialog(org)}
                            disabled={!canUpdate}
                            title={!canUpdate ? 'Sem permissão' : undefined}
                          >
                            <Edit className="h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={() => handleDelete(org.id)}
                            disabled={!canDelete}
                            title={!canDelete ? 'Sem permissão' : undefined}
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpened}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingOrg ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
              <DialogDescription>
                Preencha os dados da empresa abaixo. Ao criar, um usuário administrador será gerado automaticamente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Seletor de Tenant */}
              <div className="grid gap-2">
                <Label htmlFor="tenant">Tenant</Label>
                <Select
                  value={String(formData.tenant_id)}
                  onValueChange={(value) => setFormData({ ...formData, tenant_id: parseInt(value, 10) })}
                >
                  <SelectTrigger id="tenant">
                    <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Selecione o tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1" disabled>Selecione o tenant</SelectItem>
                    {tenantOptions.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da empresa"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@empresa.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="document">Documento (CNPJ/CPF)</Label>
                <Input
                  id="document"
                  value={formData.document}
                  onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
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
                permission={editingOrg ? 'tenant.organizations.update' : 'tenant.organizations.create'}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingOrg ? 'Salvar Alterações' : 'Criar Empresa'}
              </PermissionButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
