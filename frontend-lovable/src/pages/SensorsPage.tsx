import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Gauge,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Filter,
  ChevronDown,
  Settings,
  Cpu,
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

type StatusOption = 'active' | 'inactive' | 'error';

interface Sensor {
  id: number;
  uuid: string;
  name: string;
  type: string;
  status: string;
  equipment_id: number;
  last_value: number;
  created_at: string;
}

interface Equipment {
  id: number;
  name: string;
}

export default function SensorsPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreate = hasPermission('tenant.sensors.create');
  const canUpdate = hasPermission('tenant.sensors.update');
  const canDelete = hasPermission('tenant.sensors.delete');
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusOption[]>(['active', 'error']);
  const [isDialogOpen, setIsDialogOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSensor, setEditingSensor] = useState<Sensor | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'temperature',
    status: 'active',
    equipment_id: -1,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [sensorsRes, equipsRes] = await Promise.all([
        api.get<Sensor[]>('/tenant/sensors'),
        api.get<Equipment[]>('/tenant/equipments')
      ]);
      setSensors(sensorsRes.data || []);
      setEquipments(equipsRes.data || []);
    } catch (error) {
      console.error('Error fetching sensors:', error);
      setSensors([]);
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

  const filteredSensors = sensors.filter((sensor) => {
    const searchLower = searchQuery.toLowerCase();
    const equipName = equipments.find(e => e.id === sensor.equipment_id)?.name.toLowerCase() || '';
    const matchesSearch = 
      (sensor.name?.toLowerCase() || '').includes(searchLower) ||
      (sensor.uuid?.toLowerCase() || '').includes(searchLower) ||
      (sensor.type?.toLowerCase() || '').includes(searchLower) ||
      equipName.includes(searchLower);

    if (selectedStatus.length === 0) return false;
    const matchesStatus = selectedStatus.includes(sensor.status as StatusOption);

    return matchesSearch && matchesStatus;
  });

  const handleOpenDialog = (sensor?: Sensor) => {
    if (sensor) {
      setEditingSensor(sensor);
      setFormData({
        name: sensor.name || '',
        type: sensor.type || 'temperature',
        status: sensor.status || 'active',
        equipment_id: sensor.equipment_id || -1,
      });
    } else {
      setEditingSensor(null);
      setFormData({
        name: '',
        type: 'temperature',
        status: 'active',
        equipment_id: equipments.length > 0 ? equipments[0].id : -1,
      });
    }
    setIsDialogOpened(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSensor ? !canUpdate : !canCreate) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    if (formData.equipment_id === -1) {
      toast.error('Selecione um equipamento');
      return;
    }
    setIsSubmitting(true);

    try {
      if (editingSensor) {
        await api.put(`/tenant/sensors/${editingSensor.id}`, formData);
        toast.success('Sensor atualizado!');
      } else {
        await api.post('/tenant/sensors', formData);
        toast.success('Sensor criado!');
      }
      setIsDialogOpened(false);
      fetchData();
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
    if (!confirm('Excluir sensor?')) return;
    try {
      await api.delete(`/tenant/sensors/${id}`);
      toast.success('Excluído!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao excluir');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-success/10 text-success border-success/20">Ativo</Badge>;
      case 'error': return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Erro</Badge>;
      case 'inactive': return <Badge variant="secondary">Inativo</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) return <div className="p-6"><SkeletonTable rows={5} /></div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Sensores</h1>
        <PermissionButton onClick={() => handleOpenDialog()} className="gap-2" permission="tenant.sensors.create">
          <Plus className="h-4 w-4" /> Novo Sensor
        </PermissionButton>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, UUID ou tipo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2"><Filter className="h-4 w-4" /> Status: {selectedStatus.length} selecionados</Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            {['active', 'error', 'inactive'].map((s) => (
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
              <TableHead>Sensor</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Último Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12 text-center"><Settings className="h-4 w-4 mx-auto" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSensors.map((sensor) => (
              <TableRow key={sensor.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Gauge className="h-4 w-4" /></div>
                    <div><p className="font-medium">{sensor.name}</p><p className="text-[10px] text-muted-foreground">{sensor.type}</p></div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Cpu className="h-3 w-3" /> {equipments.find(e => e.id === sensor.equipment_id)?.name || '—'}
                  </div>
                </TableCell>
                <TableCell className="font-mono">{sensor.last_value ?? '—'}</TableCell>
                <TableCell>{getStatusBadge(sensor.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleOpenDialog(sensor)}
                        disabled={!canUpdate}
                        title={!canUpdate ? 'Sem permissão' : undefined}
                      >
                        <Edit className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(sensor.id)}
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
            <DialogHeader><DialogTitle>{editingSensor ? 'Editar' : 'Novo'} Sensor</DialogTitle></DialogHeader>
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
            </div>
            <div className="grid gap-2">
              <Label>Equipamento</Label>
              <Select value={String(formData.equipment_id)} onValueChange={(v) => setFormData({...formData, equipment_id: parseInt(v)})}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {equipments.map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData({...formData, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="temperature">Temperatura</SelectItem>
                  <SelectItem value="humidity">Umidade</SelectItem>
                  <SelectItem value="pressure">Pressão</SelectItem>
                  <SelectItem value="voltage">Tensão</SelectItem>
                  <SelectItem value="current">Corrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({...formData, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="error">Erro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <PermissionButton
                type="submit"
                disabled={isSubmitting}
                permission={editingSensor ? 'tenant.sensors.update' : 'tenant.sensors.create'}
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
