import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Filter,
  ChevronDown,
  Settings,
  Building2,
  FolderKanban,
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

type StatusOption = 'active' | 'inactive' | 'maintenance';

interface Equipment {
  id: number;
  uuid: string;
  name: string;
  description: string;
  status: string;
  organization_id: number;
  workspace_id: number;
  created_at: string;
}

export default function EquipmentsPage() {
  const { organizations, workspaces, fetchWorkspaces } = useSaaSContext();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreate = hasPermission('tenant.equipments.create');
  const canUpdate = hasPermission('tenant.equipments.update');
  const canDelete = hasPermission('tenant.equipments.delete');
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusOption[]>(['active', 'maintenance']);
  const [isDialogOpen, setIsDialogOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEquip, setEditingEquip] = useState<Equipment | null>(null);
  
  const [formData, setFormData] = useState({
    uuid: '',
    name: '',
    description: '',
    status: 'active',
    organization_id: -1,
    workspace_id: -1,
  });
  const availableWorkspaces =
    formData.organization_id >= 0
      ? workspaces.filter((w) => w.organization_id === formData.organization_id)
      : workspaces;
  const organizationOptions = organizations;

  useEffect(() => {
    fetchEquipments();
  }, []);

  const fetchEquipments = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Equipment[]>('/tenant/equipments'); // Rota baseada no padrão
      setEquipments(response.data || []);
    } catch (error) {
      console.error('Error fetching equipments:', error);
      setEquipments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = (status: StatusOption) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const filteredEquipments = equipments.filter((equip) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (equip.name?.toLowerCase() || '').includes(searchLower) ||
      (equip.uuid?.toLowerCase() || '').includes(searchLower);

    if (selectedStatus.length === 0) return false;
    const matchesStatus = selectedStatus.includes(equip.status as StatusOption);

    return matchesSearch && matchesStatus;
  });

  const handleOpenDialog = (equip?: Equipment) => {
    if (equip) {
      setEditingEquip(equip);
      setFormData({
        uuid: equip.uuid || '',
        name: equip.name || '',
        description: equip.description || '',
        status: equip.status || 'active',
        organization_id: equip.organization_id ?? -1,
        workspace_id: equip.workspace_id ?? -1,
      });
      if (equip.organization_id !== undefined && equip.organization_id !== null) {
        fetchWorkspaces(equip.organization_id);
      }
    } else {
      setEditingEquip(null);
      setFormData({
        uuid: '',
        name: '',
        description: '',
        status: 'active',
        organization_id: -1,
        workspace_id: -1,
      });
    }
    setIsDialogOpened(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEquip ? !canUpdate : !canCreate) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    if (formData.organization_id === -1 || formData.workspace_id === -1) {
      toast.error('Selecione uma empresa e um local');
      return;
    }
    setIsSubmitting(true);

    try {
      if (editingEquip) {
        await api.put(`/tenant/equipments/${editingEquip.id}`, formData);
        toast.success('Equipamento atualizado!');
      } else {
        await api.post('/tenant/equipments', formData);
        toast.success('Equipamento criado!');
      }
      setIsDialogOpened(false);
      fetchEquipments();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao salvar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canDelete) {
      toast.error('Você não tem permissão para excluir.');
      return;
    }
    if (!confirm('Excluir equipamento?')) return;
    try {
      await api.delete(`/tenant/equipments/${id}`);
      toast.success('Excluído!');
      fetchEquipments();
    } catch (error: any) {
      toast.error('Erro ao excluir');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>;
      case 'maintenance': return <Badge className="bg-warning/10 text-warning border-warning/20">Manutenção</Badge>;
      case 'inactive': return <Badge variant="secondary">Inativo</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) return <div className="p-6"><SkeletonTable rows={5} /></div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Equipamentos</h1>
        <PermissionButton onClick={() => handleOpenDialog()} className="gap-2" permission="tenant.equipments.create">
          <Plus className="h-4 w-4" /> Novo Equipamento
        </PermissionButton>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou UUID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" /> Status: {selectedStatus.length} selecionados</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            {['active', 'maintenance', 'inactive'].map((s) => (
              <div key={s} className="flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer" onClick={() => toggleStatus(s as any)}>
                <Checkbox checked={selectedStatus.includes(s as any)} />
                <span className="capitalize">{s}</span>
              </div>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipamento</TableHead>
              <TableHead>Empresa/Local</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-center"><Settings className="h-4 w-4 mx-auto" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEquipments.map((equip) => (
              <TableRow key={equip.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Cpu className="h-4 w-4" /></div>
                    <div><p className="font-medium">{equip.name}</p><p className="text-[10px] text-muted-foreground">{equip.uuid}</p></div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {organizations.find(o => o.id === equip.organization_id)?.name || '—'}</div>
                    <div className="flex items-center gap-1"><FolderKanban className="h-3 w-3" /> {workspaces.find(w => w.id === equip.workspace_id)?.name || '—'}</div>
                  </div>
                </TableCell>
                <TableCell>{getStatusBadge(equip.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleOpenDialog(equip)}
                        disabled={!canUpdate}
                        title={!canUpdate ? 'Sem permissão' : undefined}
                      >
                        <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(equip.id)}
                        className="text-destructive"
                        disabled={!canDelete}
                        title={!canDelete ? 'Sem permissão' : undefined}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir
                      </DropdownMenuItem>
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
            <DialogHeader><DialogTitle>{editingEquip ? 'Editar' : 'Novo'} Equipamento</DialogTitle></DialogHeader>
            <div className="grid gap-2">
              <Label>UUID</Label>
              <Input
                value={formData.uuid}
                onChange={(e) => setFormData({ ...formData, uuid: e.target.value })}
                placeholder="UUID do equipamento"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Empresa</Label>
              <Select value={String(formData.organization_id)} onValueChange={(v) => {
                const id = parseInt(v);
                if (id === 0) {
                  setFormData({ ...formData, organization_id: 0, workspace_id: 0 });
                  fetchWorkspaces(0);
                  return;
                }
                setFormData({ ...formData, organization_id: id, workspace_id: -1 });
                fetchWorkspaces(id);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Map(
                    [{ id: 0, name: 'Todas as empresas' }, ...organizationOptions]
                      .map((o) => [o.id, o])
                  ).values()).map((o) => (
                    <SelectItem key={`org-${o.id}`} value={String(o.id)}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Local</Label>
              <Select
                value={String(formData.workspace_id)}
                onValueChange={(v) => setFormData({ ...formData, workspace_id: parseInt(v) })}
                disabled={formData.organization_id === -1}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(formData.organization_id === 0
                    ? Array.from(new Map(
                        [{ id: 0, name: 'Todos os locais' }, ...availableWorkspaces]
                          .map((w) => [w.id, w])
                      ).values())
                    : availableWorkspaces
                  ).map((w) => (
                    <SelectItem key={`ws-${w.id}`} value={String(w.id)}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="maintenance">Manutenção</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <PermissionButton
                type="submit"
                disabled={isSubmitting}
                permission={editingEquip ? 'tenant.equipments.update' : 'tenant.equipments.create'}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar
              </PermissionButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
