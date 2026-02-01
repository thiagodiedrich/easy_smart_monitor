import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Webhook,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Link,
  Copy,
  Check,
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
import type { Webhook as WebhookType } from '@/types';
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

export default function WebhooksPage() {
  const { organizations, fetchOrganizations } = useSaaSContext();
  const [webhooks, setWebhooks] = useState<WebhookType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusOption[]>(['active', 'blocked']);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpened] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    status: 'active' as StatusOption,
    organization_id: -1,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchWebhooks(),
        fetchOrganizations()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWebhooks = async () => {
    try {
      const response = await api.get<WebhookType[]>('/tenant/webhooks');
      setWebhooks(response.data || []);
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      setWebhooks([]);
    }
  };

  const handleOpenDialog = (webhook?: WebhookType) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData({
        name: webhook.name || '',
        url: webhook.url || '',
        events: webhook.events || [],
        status: (webhook.status as StatusOption) || 'active',
        organization_id: webhook.organization_id || -1,
      });
    } else {
      setEditingWebhook(null);
      setFormData({
        name: '',
        url: '',
        events: ['telemetry.received'],
        status: 'active',
        organization_id: -1,
      });
    }
    setIsDialogOpened(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        organization_id: formData.organization_id === -1 ? 0 : formData.organization_id
      };

      if (editingWebhook) {
        await api.put(`/tenant/webhooks/${editingWebhook.id}`, payload);
        toast.success('Webhook atualizado com sucesso!');
      } else {
        await api.post('/tenant/webhooks', payload);
        toast.success('Webhook criado com sucesso!');
      }
      setIsDialogOpened(false);
      fetchWebhooks();
    } catch (error: any) {
      console.error('Error saving webhook:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar webhook');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este webhook?')) return;

    try {
      await api.delete(`/tenant/webhooks/${id}`);
      toast.success('Webhook excluído com sucesso!');
      fetchWebhooks();
    } catch (error: any) {
      console.error('Error deleting webhook:', error);
      toast.error(error.response?.data?.error || 'Erro ao excluir webhook');
    }
  };

  const copyUrl = (webhook: WebhookType) => {
    navigator.clipboard.writeText(webhook.url);
    setCopiedId(webhook.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleStatus = (status: StatusOption) => {
    setSelectedStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status) 
        : [...prev, status]
    );
  };

  const filteredWebhooks = webhooks.filter((wh) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (wh.name?.toLowerCase() || '').includes(searchLower) ||
      (wh.url?.toLowerCase() || '').includes(searchLower) ||
      (wh.status?.toLowerCase() || '').includes(searchLower);

    if (selectedStatus.length === 0) return false;
    const matchesStatus = selectedStatus.includes(wh.status as StatusOption);

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
            <h1 className="text-2xl font-bold">Webhooks</h1>
            <p className="text-muted-foreground">Gerencie integrações via webhook</p>
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
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-muted-foreground">
            Gerencie integrações via webhook ({webhooks.length})
          </p>
        </div>
        <Button className="gap-2" onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4" />
          Novo Webhook
        </Button>
      </motion.div>

      {/* Search and Filter */}
      <motion.div variants={item} className="flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar webhooks..."
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
        {filteredWebhooks.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="Nenhum webhook encontrado"
            description="Não há webhooks correspondentes aos seus filtros."
            action={{
              label: 'Criar Webhook',
              onClick: () => handleOpenDialog(),
            }}
          />
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Nome</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12 text-center">
                    <Settings className="h-4 w-4 text-muted-foreground mx-auto" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWebhooks.map((wh) => (
                  <TableRow key={wh.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Link className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{wh.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground max-w-[300px] truncate">
                          {wh.url}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyUrl(wh)}
                        >
                          {copiedId === wh.id ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(wh.events || []).slice(0, 2).map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                        {(wh.events || []).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{(wh.events || []).length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(wh.status)}</TableCell>
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
                          <DropdownMenuItem className="gap-2" onClick={() => handleOpenDialog(wh)}>
                            <Edit className="h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => handleDelete(wh.id)}>
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
              <DialogTitle>{editingWebhook ? 'Editar Webhook' : 'Novo Webhook'}</DialogTitle>
              <DialogDescription>
                Preencha os dados da integração abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome da integração"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="url">URL do Webhook</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://sua-api.com/webhook"
                  required
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
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingWebhook ? 'Salvar Alterações' : 'Criar Webhook'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
