import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Filter,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonTable } from '@/components/ui/skeleton-card';
import { useSaaSContext } from '@/hooks/useSaaSContext';
import { useAuthStore } from '@/stores/authStore';
import { PermissionButton } from '@/components/auth/PermissionButton';
import api from '@/services/api';
import type { Alert, AlertHistory } from '@/types';
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

export default function AlertsPage() {
  const { organizations, fetchOrganizations } = useSaaSContext();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canCreate = hasPermission('tenant.alerts.create');
  const canUpdate = hasPermission('tenant.alerts.update');
  const canDelete = hasPermission('tenant.alerts.delete');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusOption[]>(['active', 'blocked']);
  const [activeTab, setActiveTab] = useState('alerts');
  const [isDialogOpen, setIsDialogOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    condition: '',
    threshold: 0,
    severity: 'medium' as any,
    status: 'active' as StatusOption,
    organization_id: -1,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [alertsRes, historyRes] = await Promise.all([
        api.get<Alert[]>('/tenant/alerts'),
        api.get<AlertHistory[]>('/tenant/alerts/history'),
        fetchOrganizations()
      ]);
      setAlerts(alertsRes.data || []);
      setHistory(historyRes.data || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlerts([]);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (alert?: Alert) => {
    if (alert) {
      setEditingAlert(alert);
      setFormData({
        name: alert.name || '',
        description: alert.description || '',
        condition: alert.condition || '',
        threshold: alert.threshold || 0,
        severity: alert.severity || 'medium',
        status: (alert.status as StatusOption) || 'active',
        organization_id: alert.organization_id || -1,
      });
    } else {
      setEditingAlert(null);
      setFormData({
        name: '',
        description: '',
        condition: '',
        threshold: 0,
        severity: 'medium',
        status: 'active',
        organization_id: -1,
      });
    }
    setIsDialogOpened(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAlert ? !canUpdate : !canCreate) {
      toast.error('Você não tem permissão para esta ação.');
      return;
    }
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        organization_id: formData.organization_id === -1 ? 0 : formData.organization_id
      };

      if (editingAlert) {
        await api.put(`/tenant/alerts/${editingAlert.id}`, payload);
        toast.success('Alerta atualizado com sucesso!');
      } else {
        await api.post('/tenant/alerts', payload);
        toast.success('Alerta criado com sucesso!');
      }
      setIsDialogOpened(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving alert:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar alerta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canDelete) {
      toast.error('Você não tem permissão para excluir.');
      return;
    }
    if (!confirm('Tem certeza que deseja excluir este alerta?')) return;

    try {
      await api.delete(`/tenant/alerts/${id}`);
      toast.success('Alerta excluído com sucesso!');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting alert:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir alerta');
    }
  };

  const toggleStatus = (status: StatusOption) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const filteredAlerts = alerts.filter((alert) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (alert.name?.toLowerCase() || '').includes(searchLower) ||
      (alert.description?.toLowerCase() || '').includes(searchLower) ||
      (alert.condition?.toLowerCase() || '').includes(searchLower) ||
      (alert.severity?.toLowerCase() || '').includes(searchLower) ||
      (alert.status?.toLowerCase() || '').includes(searchLower);

    if (selectedStatus.length === 0) return false;
    const matchesStatus = selectedStatus.includes(alert.status as StatusOption);

    return matchesSearch && matchesStatus;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-destructive text-destructive-foreground">Crítico</Badge>;
      case 'high':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Alto</Badge>;
      case 'medium':
        return <Badge className="bg-accent/10 text-accent border-accent/20">Médio</Badge>;
      case 'low':
        return <Badge variant="secondary">Baixo</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
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
            <h1 className="text-2xl font-bold">Alertas</h1>
            <p className="text-muted-foreground">Gerencie regras e histórico de alertas</p>
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
          <h1 className="text-2xl font-bold">Alertas</h1>
          <p className="text-muted-foreground">
            Gerencie regras e histórico de alertas
          </p>
        </div>
        <PermissionButton className="gap-2" onClick={() => handleOpenDialog()} permission="tenant.alerts.create">
          <Plus className="h-4 w-4" />
          Novo Alerta
        </PermissionButton>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {alerts.filter((a) => a.severity === 'critical' && a.status === 'active').length}
                </p>
                <p className="text-sm text-muted-foreground">Alertas Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {alerts.filter((a) => a.status === 'active').length}
                </p>
                <p className="text-sm text-muted-foreground">Alertas Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{history.length}</p>
                <p className="text-sm text-muted-foreground">Disparos Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={item}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="alerts">Regras de Alerta</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <div className="relative flex-1 w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>

              {activeTab === 'alerts' && (
                <div className="w-full sm:w-auto">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-[200px] justify-between font-normal">
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
                    <PopoverContent className="w-[200px] p-2" align="start">
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
              )}
            </div>
          </div>

          <TabsContent value="alerts">
            {filteredAlerts.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Nenhum alerta encontrado"
                description="Não há alertas correspondentes aos seus filtros."
                action={
                  canCreate
                    ? { label: 'Criar Alerta', onClick: () => handleOpenDialog() }
                    : undefined
                }
              />
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Nome</TableHead>
                      <TableHead>Condição</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12 text-center">
                        <Settings className="h-4 w-4 text-muted-foreground mx-auto" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAlerts.map((alert) => (
                      <TableRow key={alert.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                              <Bell className="h-4 w-4 text-warning" />
                            </div>
                            <div>
                              <span className="font-medium">{alert.name}</span>
                              {alert.description && (
                                <p className="text-xs text-muted-foreground">{alert.description}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="px-2 py-1 bg-muted rounded text-xs">
                            {alert.condition}
                          </code>
                        </TableCell>
                        <TableCell className="font-mono">{alert.threshold}</TableCell>
                        <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                        <TableCell>{getStatusBadge(alert.status)}</TableCell>
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
                                onClick={() => handleOpenDialog(alert)}
                                disabled={!canUpdate}
                                title={!canUpdate ? 'Sem permissão' : undefined}
                              >
                                <Edit className="h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => handleDelete(alert.id)}
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
          </TabsContent>

          <TabsContent value="history">
            {history.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Nenhum alerta disparado"
                description="O histórico de alertas disparados aparecerá aqui."
              />
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Alerta</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data/Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.alert_name}</TableCell>
                        <TableCell className="font-mono">{h.value}</TableCell>
                        <TableCell>
                          {h.status === 'triggered' ? (
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20">
                              Disparado
                            </Badge>
                          ) : (
                            <Badge className="bg-success/10 text-success border-success/20">
                              Resolvido
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(h.triggered_at).toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpened}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingAlert ? 'Editar Alerta' : 'Novo Alerta'}</DialogTitle>
              <DialogDescription>
                Preencha os dados da regra de alerta abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do alerta"
                  required
                />
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
                <Label htmlFor="org">Empresa</Label>
                <Select 
                  value={String(formData.organization_id)} 
                  onValueChange={(value) => setFormData({ ...formData, organization_id: parseInt(value) })}
                >
                  <SelectTrigger id="org">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-1">Todas Empresas</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="condition">Condição (ex: value &gt; 80)</Label>
                <Input
                  id="condition"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  placeholder="value > 80"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="threshold">Threshold (Valor Limite)</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) })}
                  placeholder="80"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="severity">Severidade</Label>
                <Select 
                  value={formData.severity} 
                  onValueChange={(value) => setFormData({ ...formData, severity: value })}
                >
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Selecione a severidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="critical">Crítica</SelectItem>
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
                permission={editingAlert ? 'tenant.alerts.update' : 'tenant.alerts.create'}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingAlert ? 'Salvar Alterações' : 'Criar Alerta'}
              </PermissionButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
