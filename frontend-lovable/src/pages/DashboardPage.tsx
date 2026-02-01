import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Cpu,
  Gauge,
  Bell,
  TrendingUp,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { SkeletonCard, SkeletonChart } from '@/components/ui/skeleton-card';
import { useSaaSContext } from '@/hooks/useSaaSContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

// Mock data for demonstration
const telemetryData = [
  { time: '00:00', value: 45, readings: 120 },
  { time: '04:00', value: 52, readings: 145 },
  { time: '08:00', value: 78, readings: 210 },
  { time: '12:00', value: 85, readings: 280 },
  { time: '16:00', value: 72, readings: 245 },
  { time: '20:00', value: 58, readings: 180 },
  { time: '24:00', value: 48, readings: 130 },
];

const recentAlerts = [
  {
    id: 1,
    name: 'Temperatura Alta',
    device: 'Sensor-001',
    severity: 'high',
    time: '2 min atrás',
  },
  {
    id: 2,
    name: 'Conexão Perdida',
    device: 'Gateway-A',
    severity: 'critical',
    time: '15 min atrás',
  },
  {
    id: 3,
    name: 'Bateria Baixa',
    device: 'Sensor-042',
    severity: 'medium',
    time: '1 hora atrás',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const { currentOrganization, currentWorkspace, isGlobalAccess } = useSaaSContext();

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive text-destructive-foreground';
      case 'high':
        return 'bg-warning text-warning-foreground';
      case 'medium':
        return 'bg-accent text-accent-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

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
          <h1 className="text-2xl font-bold">Painel de Controle</h1>
          <p className="text-muted-foreground">
            {isGlobalAccess
              ? 'Visão geral de todos os dispositivos'
              : currentWorkspace
              ? `Workspace: ${currentWorkspace.name}`
              : currentOrganization
              ? `Organization: ${currentOrganization.name}`
              : 'Visão geral'}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Atualizado há 2 minutos
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Dispositivos Ativos"
          value="127"
          description="de 150 cadastrados"
          icon={Cpu}
          trend={{ value: 5.2, isPositive: true }}
        />
        <StatCard
          title="Sensores Online"
          value="384"
          description="Coletando dados"
          icon={Gauge}
          trend={{ value: 2.1, isPositive: true }}
        />
        <StatCard
          title="Leituras Hoje"
          value="12.4k"
          description="Telemetrias recebidas"
          icon={Activity}
          trend={{ value: 12.5, isPositive: true }}
        />
        <StatCard
          title="Alertas Ativos"
          value="3"
          description="Requerem atenção"
          icon={Bell}
          trend={{ value: 1, isPositive: false }}
        />
      </motion.div>

      {/* Charts Row */}
      <motion.div variants={item} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Telemetry Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Telemetria 24h</CardTitle>
            <Badge variant="outline" className="font-normal">
              <Activity className="h-3 w-3 mr-1" />
              Em tempo real
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Readings Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Leituras por Hora</CardTitle>
            <Badge variant="outline" className="font-normal">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12.5%
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="readings"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Alerts */}
      <motion.div variants={item}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Alertas Recentes</CardTitle>
            <a href="/alerts" className="text-sm text-accent hover:underline">
              Ver todos
            </a>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{alert.name}</p>
                      <p className="text-xs text-muted-foreground">{alert.device}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getSeverityColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
