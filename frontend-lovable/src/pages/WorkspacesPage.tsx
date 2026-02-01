import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Building2,
  Settings,
  Filter,
  ChevronDown,
  Loader2,
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
import api from '@/services/api';
import type { Workspace } from '@/types';
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

type StatusOption = 'active' | 'blocked' | 'inactive';

export default function WorkspacesPage() {
  const { workspaces, organizations, isLoading, fetchWorkspaces, currentOrganization } = useSaaSContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusOption[]>(['active', 'blocked']);
  const [isDialogOpen, setIsDialogOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    organization_id: 0,
    status: 'active' as StatusOption,
  });

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleOpenDialog = (ws?: Workspace) => {
    if (ws) {
      setEditingWorkspace(ws);
      setFormData({
        name: ws.name || '',
        description: ws.description || '',
        organization_id: ws.organization_id,
        status: (ws.status as StatusOption) || 'active',
      });
    } else {
      setEditingWorkspace(null);
      setFormData({
        name: '',
        description: '',
        organization_id: -1, // Usamos -1 para indicar "nenhuma selecionada"
        status: 'active',
      });
    }
    setIsDialogOpened(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting workspace form data:', formData);
    
    if (formData.organization_id === -1) {
      toast.error('Selecione uma empresa');
      return;
    }
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        organization_id: Number(formData.organization_id)
      };
      
      console.log('Sending payload to API:', payload);

      if (editingWorkspace) {
        // Na edição, a API espera apenas os campos que mudaram ou o conjunto permitido
        // Algumas APIs ignoram o organization_id no PUT se ele for parte da chave
        await api.put(`/tenant/workspaces/${editingWorkspace.id}`, {
          name: payload.name,
          description: payload.description,
          status: payload.status,
          organization_id: payload.organization_id // Enviando explicitamente
        });
        toast.success('Local atualizado com sucesso!');
      } else {
        await api.post('/tenant/workspaces', payload);
        toast.success('Local criado com sucesso!');
      }
      setIsDialogOpened(false);
      fetchWorkspaces();
    } catch (error: any) {
      console.error('Error saving workspace:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar local');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este local?')) return;

    try {
      await api.delete(`/tenant/workspaces/${id}`);
      toast.success('Local excluído com sucesso!');
      fetchWorkspaces();
    } catch (error: any) {
      console.error('Error deleting workspace:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir local');
    }
  };

  const toggleStatus = (status: StatusOption) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const getOrganizationName = (orgId: number) => {
    const org = organizations.find((o) => o.id === orgId);
    return org?.name ?? '—';
  };

  const filteredWorkspaces = workspaces.filter((ws) => {
    // 1. Busca Global
    const searchLower = searchQuery.toLowerCase();
    const orgName = getOrganizationName(ws.organization_id).toLowerCase();
    const matchesSearch = 
      (ws.name?.toLowerCase() || '').includes(searchLower) ||
      (ws.description?.toLowerCase() || '').includes(searchLower) ||
      orgName.includes(searchLower) ||
      (ws.status?.toLowerCase() || '').includes(searchLower);

    // 2. Filtro de Status
    if (selectedStatus.length === 0) return false;
    // Workspaces podem não ter status 'blocked' no banco, mas tratamos para consistência da UI
    const matchesStatus = selectedStatus.includes(ws.status as StatusOption);

    return matchesSearch && matchesStatus;
  });

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
            <h1 className="text-2xl font-bold">Locais</h1>
            <p className="text-muted-foreground">Gerencie seus locais</p>
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
          <h1 className="text-2xl font-bold">Locais</h1>
          <p className="text-muted-foreground">
            Gerencie seus locais ({workspaces.length})
            {currentOrganization && ` em ${currentOrganization.name}`}
          </p>
        </div>
        <Button className="gap-2" onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4" />
          Novo Local
        </Button>
      </motion.div>

      {/* Search and Filter */}
      <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa, descrição..."
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
        {filteredWorkspaces.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="Nenhum local encontrado"
            description="Não há locais correspondentes aos seus filtros."
            action={{
              label: 'Criar Local',
              onClick: () => handleOpenDialog(),
            }}
          />
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Nome</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-12 text-center">
                    <Settings className="h-4 w-4 text-muted-foreground mx-auto" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkspaces.map((ws) => (
                  <TableRow key={ws.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FolderKanban className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{ws.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        {getOrganizationName(ws.organization_id)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ws.description || '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(ws.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(ws.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
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
                          <DropdownMenuItem className="gap-2" onClick={() => handleOpenDialog(ws)}>
                            <Edit className="h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={() => handleDelete(ws.id)}
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
              <DialogTitle>{editingWorkspace ? 'Editar Empresa' : 'Novo Local'}</DialogTitle>
              <DialogDescription>
                Preencha os dados do local abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do local"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="org">Empresa</Label>
                <Select 
                  value={String(formData.organization_id)} 
                  onValueChange={(value) => {
                    console.log('Selected org value:', value);
                    setFormData({ ...formData, organization_id: parseInt(value) });
                  }}
                >
                  <SelectTrigger id="org">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">Selecione a empresa</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional"
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingWorkspace ? 'Salvar Alterações' : 'Criar Local'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
