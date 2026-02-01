import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Search,
  Filter,
  ChevronDown,
  Settings,
  User,
  Activity,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { SkeletonTable } from '@/components/ui/skeleton-card';
import api from '@/services/api';

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

interface AuditLog {
  id: number;
  action: string;
  target_type: string;
  target_id: string;
  actor_user_id: number;
  actor_role: string;
  metadata: any;
  created_at: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActions, setSelectedStatus] = useState<string[]>([]); // Usado como filtro de ação

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const response = await api.get<AuditLog[]>('/tenant/audit-logs'); // Rota baseada no padrão
      setLogs(response.data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      (log.action?.toLowerCase() || '').includes(searchLower) ||
      (log.target_type?.toLowerCase() || '').includes(searchLower) ||
      (log.actor_role?.toLowerCase() || '').includes(searchLower);

    const matchesAction = selectedActions.length === 0 || selectedActions.includes(log.action);

    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('create')) return <Badge className="bg-success/10 text-success border-success/20">Criação</Badge>;
    if (action.includes('update')) return <Badge className="bg-warning/10 text-warning border-warning/20">Edição</Badge>;
    if (action.includes('delete')) return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Exclusão</Badge>;
    return <Badge variant="outline">{action}</Badge>;
  };

  if (isLoading) return <div className="p-6"><SkeletonTable rows={10} /></div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Logs de Auditoria</h1>
        <Button variant="outline" onClick={fetchLogs} className="gap-2"><Activity className="h-4 w-4" /> Atualizar</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por ação, alvo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Alvo</TableHead>
              <TableHead>Usuário/Role</TableHead>
              <TableHead className="w-12 text-center"><Settings className="h-4 w-4 mx-auto" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </TableCell>
                <TableCell>{getActionBadge(log.action)}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium capitalize text-sm">{log.target_type.replace('_', ' ')}</span>
                    <span className="text-[10px] text-muted-foreground">ID: {log.target_id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-xs">
                    <User className="h-3 w-3" />
                    <span>ID: {log.actor_user_id}</span>
                    <Badge variant="outline" className="text-[10px]">{log.actor_role}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                   <Popover>
                     <PopoverTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></PopoverTrigger>
                     <PopoverContent className="w-80">
                       <pre className="text-[10px] bg-muted p-2 rounded overflow-auto max-h-40">
                         {JSON.stringify(log.metadata, null, 2)}
                       </pre>
                     </PopoverContent>
                   </Popover>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}
