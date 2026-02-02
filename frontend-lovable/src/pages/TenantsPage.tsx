import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Filter,
  ChevronDown,
  Settings,
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
import type { Tenant } from '@/types';
import { toast } from 'sonner';

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

type StatusOption = 'active' | 'inactive';

export default function TenantsPage() {
  const { tenants, isLoading, fetchTenants } = useSaaSContext();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreate = hasPermission('admin.tenants.create');
  const canUpdate = hasPermission('admin.tenants.update');
  const canDelete = hasPermission('admin.tenants.delete');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusOption[]>(['active']);
  const [isDialogOpen, setIsDialogOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    status: 'active' as StatusOption,
    plan_code: 'legacy',
    email: '',
    password: '',
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const toggleStatus = (status: StatusOption) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const filteredTenants = tenants.filter((t) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (t.name?.toLowerCase() || '').includes(searchLower) ||
      (t.slug?.toLowerCase() || '').includes(searchLower);

    if (selectedStatus.length === 0) return false;
    const matchesStatus = selectedStatus.includes(t.status as StatusOption);

    return matchesSearch && matchesStatus;
  });

  const handleOpenDialog = (tenant?: Tenant) => {
    if (tenant) {
      setEditingTenant(tenant);
      setFormData({
        name: tenant.name || '',
        slug: tenant.slug || '',
        status: (tenant.status as StatusOption) || 'active',
        plan_code: tenant.plan_code || 'legacy',
        email: '',
        password: '',
      });
    } else {
      setEditingTenant(null);
      setFormData({
        name: '',
        slug: '',
        status: 'active',
        plan_code: 'legacy',
        email: '',
        password: '',
      });
    }
    setIsDialogOpened(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingTenant) {
        await api.put(`/admin/tenants/${editingTenant.id}`, formData);
        toast.success('Tenant atualizado com sucesso!');
      } else {
        await api.post('/admin/tenants', formData);
        toast.success('Tenant, Empresa e Admin criados com sucesso!');
      }
      setIsDialogOpened(false);
      fetchTenants();
    } catch (error: any) {
      console.error('Error saving tenant:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar tenant');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este tenant?')) return;
    try {
      await api.delete(`/admin/tenants/${id}`);
      toast.success('Tenant excluído!');
      fetchTenants();
    } catch (error: any) {
      toast.error('Erro ao excluir tenant');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>;
      case 'inactive': return <Badge variant="secondary">Inativo</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) return <div className="p-6"><SkeletonTable rows={5} /></div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenants</h1>
          <p className="text-muted-foreground">Gerencie as instâncias de clientes ({tenants.length})</p>
        </div>
        <PermissionButton
          className="gap-2"
          onClick={() => handleOpenDialog()}
          permission="admin.tenants.create"
        >
          <Plus className="h-4 w-4" /> Novo Tenant
        </PermissionButton>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou slug..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" /> Status</Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            {['active', 'inactive'].map((s) => (
              <div key={s} className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer" onClick={() => toggleStatus(s as any)}>
                <Checkbox checked={selectedStatus.includes(s as any)} />
                <span className="capitalize">{s === 'active' ? 'Ativo' : 'Inativo'}</span>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-12 text-center"><Settings className="h-4 w-4 mx-auto" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTenants.map((t) => (
              <TableRow key={t.id} className="group">
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.slug}</code></TableCell>
                <TableCell><Badge variant="outline">{t.plan_code}</Badge></TableCell>
                <TableCell>{getStatusBadge(t.status)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(t.created_at).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(t)} disabled={!canUpdate}><Edit className="h-4 w-4 mr-2" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(t.id)} className="text-destructive" disabled={!canDelete}><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpened}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingTenant ? 'Editar Tenant' : 'Novo Tenant'}</DialogTitle>
              <DialogDescription>Ao criar um tenant, uma empresa e um usuário admin serão criados automaticamente.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome do Cliente</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="grid gap-2">
                <Label>Slug (URL)</Label>
                <Input value={formData.slug} onChange={(e) => setFormData({...formData, slug: e.target.value})} placeholder="ex: cliente-a" required disabled={!!editingTenant} />
              </div>
              {!editingTenant && (
                <>
                  <div className="grid gap-2">
                    <Label>Email do Admin</Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Senha do Admin</Label>
                    <Input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required />
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
