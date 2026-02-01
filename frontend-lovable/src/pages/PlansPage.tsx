import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  KeyRound,
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

type StatusOption = 'active' | 'inactive';

interface Plan {
  code: string;
  name: string;
  status: string;
  items_per_day: number;
  sensors_per_day: number;
  bytes_per_day: number;
  equipments_total: number;
  sensors_total: number;
  users_total: number;
  organization_total: number;
  workspace_total: number;
  collection_interval: number;
  alert_delay_seconds: number;
  created_at: string;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusOption[]>(['active']);
  const [isDialogOpen, setIsDialogOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    status: 'active',
    items_per_day: 0,
    sensors_per_day: 0,
    bytes_per_day: 0,
    equipments_total: 0,
    sensors_total: 0,
    users_total: 0,
    organization_total: 0,
    workspace_total: 0,
    collection_interval: 60,
    alert_delay_seconds: 1,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<Plan[]>('/admin/tenants/plans'); // Ajustado para rota admin
      setPlans(response.data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      // Fallback para rota alternativa se falhar
      try {
        const response = await api.get<Plan[]>('/admin/plans');
        setPlans(response.data || []);
      } catch (err) {
        setPlans([]);
      }
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

  const filteredPlans = plans.filter((plan) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (plan.name?.toLowerCase() || '').includes(searchLower) ||
      (plan.code?.toLowerCase() || '').includes(searchLower);

    if (selectedStatus.length === 0) return false;
    const matchesStatus = selectedStatus.includes(plan.status as StatusOption);

    return matchesSearch && matchesStatus;
  });

  const handleOpenDialog = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        code: plan.code,
        name: plan.name,
        status: plan.status,
        items_per_day: plan.items_per_day,
        sensors_per_day: plan.sensors_per_day,
        bytes_per_day: plan.bytes_per_day,
        equipments_total: plan.equipments_total,
        sensors_total: plan.sensors_total,
        users_total: plan.users_total,
        organization_total: plan.organization_total,
        workspace_total: plan.workspace_total,
        collection_interval: plan.collection_interval,
        alert_delay_seconds: plan.alert_delay_seconds,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        code: '',
        name: '',
        status: 'active',
        items_per_day: 10000,
        sensors_per_day: 1000,
        bytes_per_day: 104857600,
        equipments_total: 10,
        sensors_total: 100,
        users_total: 5,
        organization_total: 2,
        workspace_total: 5,
        collection_interval: 60,
        alert_delay_seconds: 1,
      });
    }
    setIsDialogOpened(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingPlan) {
        await api.put(`/admin/plans/${editingPlan.code}`, formData);
        toast.success('Plano atualizado com sucesso!');
      } else {
        await api.post('/admin/plans', formData);
        toast.success('Plano criado com sucesso!');
      }
      setIsDialogOpened(false);
      fetchPlans();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar plano');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inativo</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Planos</h1>
            <p className="text-muted-foreground">Gerencie os planos do sistema</p>
          </div>
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planos</h1>
          <p className="text-muted-foreground">Gerencie os planos e limites ({plans.length})</p>
        </div>
        <Button className="gap-2" onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4" />
          Novo Plano
        </Button>
      </motion.div>

      <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="w-full sm:w-auto">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-[200px] justify-between font-normal">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span>Status: </span>
                  <Badge variant="secondary" className="h-5 px-1 text-[10px]">
                    {selectedStatus.length === 2 ? 'Todos' : selectedStatus[0] === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-2" align="start">
              <div className="space-y-2">
                {(['active', 'inactive'] as StatusOption[]).map((status) => (
                  <div key={status} className="flex items-center space-x-2 p-2 rounded-md hover:bg-accent cursor-pointer" onClick={() => toggleStatus(status)}>
                    <Checkbox id={`status-${status}`} checked={selectedStatus.includes(status)} onCheckedChange={() => toggleStatus(status)} />
                    <label htmlFor={`status-${status}`} className="text-sm font-medium cursor-pointer flex-1 capitalize">{status === 'active' ? 'Ativo' : 'Inativo'}</label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </motion.div>

      <motion.div variants={item}>
        {filteredPlans.length === 0 ? (
          <EmptyState icon={KeyRound} title="Nenhum plano encontrado" description="Não há planos correspondentes aos seus filtros." action={{ label: 'Criar Plano', onClick: () => handleOpenDialog() }} />
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Plano</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Equips</TableHead>
                  <TableHead>Sensores</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12 text-center"><Settings className="h-4 w-4 text-muted-foreground mx-auto" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlans.map((plan) => (
                  <TableRow key={plan.code} className="group">
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{plan.code}</code></TableCell>
                    <TableCell>{plan.equipments_total}</TableCell>
                    <TableCell>{plan.sensors_total}</TableCell>
                    <TableCell>{plan.users_total}</TableCell>
                    <TableCell>{getStatusBadge(plan.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2" onClick={() => handleOpenDialog(plan)}><Edit className="h-4 w-4" /> Editar</DropdownMenuItem>
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpened}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
              <DialogDescription>Configure os limites e recursos do plano.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome do Plano</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="code">Código Único</Label>
                <Input id="code" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required disabled={!!editingPlan} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="equipments_total">Total Equipamentos</Label>
                <Input id="equipments_total" type="number" value={formData.equipments_total} onChange={(e) => setFormData({ ...formData, equipments_total: parseInt(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sensors_total">Total Sensores</Label>
                <Input id="sensors_total" type="number" value={formData.sensors_total} onChange={(e) => setFormData({ ...formData, sensors_total: parseInt(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="users_total">Total Usuários</Label>
                <Input id="users_total" type="number" value={formData.users_total} onChange={(e) => setFormData({ ...formData, users_total: parseInt(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="organization_total">Total Empresas</Label>
                <Input id="organization_total" type="number" value={formData.organization_total} onChange={(e) => setFormData({ ...formData, organization_total: parseInt(e.target.value) })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpened(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
