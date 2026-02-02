import { motion } from 'framer-motion';
import { Settings, Bell, Shield, Palette } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/authStore';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function SettingsPage() {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canUpdateSettings = hasPermission('admin.settings.read');
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="max-w-4xl space-y-6"
    >
      {/* Header */}
      <motion.div variants={item}>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações da sua conta
        </p>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-lg">Notificações</CardTitle>
                <CardDescription>Configure como você recebe alertas</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="email-alerts">Alertas por e-mail</Label>
                <p className="text-sm text-muted-foreground">
                  Receba alertas críticos por e-mail
                </p>
              </div>
              <Switch id="email-alerts" defaultChecked disabled={!canUpdateSettings} title={!canUpdateSettings ? 'Sem permissão' : undefined} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="push-notifications">Notificações push</Label>
                <p className="text-sm text-muted-foreground">
                  Receba notificações no navegador
                </p>
              </div>
              <Switch id="push-notifications" disabled={!canUpdateSettings} title={!canUpdateSettings ? 'Sem permissão' : undefined} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="daily-report">Relatório diário</Label>
                <p className="text-sm text-muted-foreground">
                  Receba um resumo diário por e-mail
                </p>
              </div>
              <Switch id="daily-report" defaultChecked disabled={!canUpdateSettings} title={!canUpdateSettings ? 'Sem permissão' : undefined} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Security */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Segurança</CardTitle>
                <CardDescription>Configurações de segurança da conta</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="two-factor">Autenticação de dois fatores</Label>
                <p className="text-sm text-muted-foreground">
                  Adicione uma camada extra de segurança
                </p>
              </div>
              <Switch id="two-factor" disabled={!canUpdateSettings} title={!canUpdateSettings ? 'Sem permissão' : undefined} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="session-timeout">Timeout de sessão</Label>
                <p className="text-sm text-muted-foreground">
                  Encerrar sessão após inatividade
                </p>
              </div>
              <Switch id="session-timeout" defaultChecked disabled={!canUpdateSettings} title={!canUpdateSettings ? 'Sem permissão' : undefined} />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Appearance */}
      <motion.div variants={item}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <Palette className="h-5 w-5 text-warning" />
              </div>
              <div>
                <CardTitle className="text-lg">Aparência</CardTitle>
                <CardDescription>Personalize a interface</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="compact-mode">Modo compacto</Label>
                <p className="text-sm text-muted-foreground">
                  Reduz o espaçamento entre elementos
                </p>
              </div>
              <Switch id="compact-mode" disabled={!canUpdateSettings} title={!canUpdateSettings ? 'Sem permissão' : undefined} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="animations">Animações</Label>
                <p className="text-sm text-muted-foreground">
                  Habilitar animações de transição
                </p>
              </div>
              <Switch id="animations" defaultChecked disabled={!canUpdateSettings} title={!canUpdateSettings ? 'Sem permissão' : undefined} />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
