'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Send,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Smartphone,
  Flame,
  PackageCheck,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

export function NotificationsDialog({ triggerButton }: { triggerButton?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingChannel, setTestingChannel] = useState<'telegram' | 'whatsapp' | null>(null);

  const [form, setForm] = useState({
    telegramEnabled: true,
    telegramBotToken: '',
    telegramChatId: '',
    whatsappEnabled: true,
    whatsappProvider: 'ultramsg' as 'ultramsg' | 'green-api',
    whatsappInstanceId: '',
    whatsappToken: '',
    whatsappPhone: '51976202683',
    minDiscountPct: 25,
    notifyOnMiamiDelivery: true,
    notifyOnRadarDeal: true,
    isTelegramConfigured: false,
    isWhatsappConfigured: false,
  });

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/notifications/settings');
      if (!res.ok) throw new Error('Error al cargar configuración');
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        ...data,
      }));
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      toast.success('¡Configuración de alertas guardada con éxito!');
      setForm((prev) => ({
        ...prev,
        ...data.config,
      }));
    } catch (err: any) {
      toast.error(err.message || 'Error guardando configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (channel: 'telegram' | 'whatsapp') => {
    try {
      setTestingChannel(channel);
      // Auto-save first if user modified inputs
      await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();

      const result = data.results?.[channel];
      if (result && result.success) {
        toast.success(
          channel === 'telegram'
            ? '¡Mensaje de prueba enviado a tu Telegram con éxito!'
            : '¡Mensaje de prueba enviado a tu WhatsApp con éxito!'
        );
      } else {
        toast.error(result?.error || 'No se pudo enviar el mensaje. Revisa tus credenciales.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error de conexión');
    } finally {
      setTestingChannel(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 text-xs font-semibold text-primary shadow-xs"
          >
            <Bell className="h-3.5 w-3.5 text-primary animate-bounce" />
            <span>Bot de Alertas (WhatsApp & Telegram)</span>
            {(form.isTelegramConfigured || form.isWhatsappConfigured) && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                Bot de Notificaciones Automáticas a tu Celular
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]">
                  Híbrido
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Recibe alertas en tiempo real en Telegram y WhatsApp (UltraMsg / Green-API) sin riesgo de baneo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando configuración...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Quick status bar */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <Send className="h-4 w-4 text-sky-500" />
                  <span className="font-semibold">Telegram Bot</span>
                </div>
                {form.isTelegramConfigured ? (
                  <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                    Sin configurar
                  </Badge>
                )}
              </div>
              <div className="flex items-center justify-between border-l pl-3">
                <div className="flex items-center gap-2 text-xs">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold">WhatsApp Web Bot</span>
                </div>
                {form.isWhatsappConfigured ? (
                  <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-[10px]">
                    Sin configurar
                  </Badge>
                )}
              </div>
            </div>

            <Tabs defaultValue="telegram" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="telegram" className="text-xs gap-1.5">
                  <Send className="h-3.5 w-3.5 text-sky-500" /> Telegram (1 Min)
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="text-xs gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
                </TabsTrigger>
                <TabsTrigger value="triggers" className="text-xs gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-amber-500" /> Reglas de Alerta
                </TabsTrigger>
              </TabsList>

              {/* TELEGRAM TAB */}
              <TabsContent value="telegram" className="space-y-4 pt-3">
                <div className="p-3 rounded-lg border bg-sky-50/50 dark:bg-sky-950/20 text-xs text-sky-900 dark:text-sky-300 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-sky-600" /> ¿Cómo crearlo gratis en 1 minuto?
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                    <li>
                      Abre Telegram, busca a <strong>@BotFather</strong> y envíale <code>/newbot</code>.
                    </li>
                    <li>Ponle un nombre y copia el <strong>Token</strong> generado (ej: <code>7123456:AAH...</code>).</li>
                    <li>
                      Abre el enlace de tu nuevo bot y dale a <strong>Iniciar (/start)</strong>.
                    </li>
                    <li>
                      Busca a <strong>@userinfobot</strong> en Telegram para ver tu <strong>Chat ID</strong> numérico.
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Activar Notificaciones por Telegram</Label>
                    <Switch
                      checked={form.telegramEnabled}
                      onCheckedChange={(v) => setForm({ ...form, telegramEnabled: v })}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Telegram Bot Token</Label>
                    <Input
                      type="password"
                      placeholder="ej: 7421890214:AAHqjWz5M6d3Q9..."
                      value={form.telegramBotToken}
                      onChange={(e) => setForm({ ...form, telegramBotToken: e.target.value })}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Tu Telegram Chat ID (Personal o Grupo)</Label>
                    <Input
                      placeholder="ej: 182940192"
                      value={form.telegramChatId}
                      onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest('telegram')}
                      disabled={testingChannel !== null || !form.telegramBotToken || !form.telegramChatId}
                      className="w-full gap-2 border-sky-300 text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950 text-xs"
                    >
                      {testingChannel === 'telegram' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Enviar Alerta de Prueba a mi Telegram
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* WHATSAPP TAB */}
              <TabsContent value="whatsapp" className="space-y-4 pt-3">
                <div className="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 text-xs text-emerald-900 dark:text-emerald-300 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> 100% Libre de Riesgo de Baneo
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Al utilizar <strong>UltraMsg</strong> o <strong>Green-API</strong> conectado con código QR (como WhatsApp Web) para enviarte alertas a <strong>tu propio número de celular</strong>, no hay ningún riesgo de bloqueo porque estás enviándote mensajes a ti mismo.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Activar Notificaciones por WhatsApp</Label>
                    <Switch
                      checked={form.whatsappEnabled}
                      onCheckedChange={(v) => setForm({ ...form, whatsappEnabled: v })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Proveedor Gateway</Label>
                      <select
                        value={form.whatsappProvider}
                        onChange={(e) => setForm({ ...form, whatsappProvider: e.target.value as any })}
                        className="w-full h-9 rounded-md border bg-background px-3 text-xs"
                      >
                        <option value="ultramsg">UltraMsg (ultramsg.com)</option>
                        <option value="green-api">Green-API (green-api.com)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Número receptor (con país)</Label>
                      <Input
                        placeholder="51976202683"
                        value={form.whatsappPhone}
                        onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Instance ID</Label>
                      <Input
                        placeholder="ej: instance12345"
                        value={form.whatsappInstanceId}
                        onChange={(e) => setForm({ ...form, whatsappInstanceId: e.target.value })}
                        className="text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Token / API Key</Label>
                      <Input
                        type="password"
                        placeholder="token..."
                        value={form.whatsappToken}
                        onChange={(e) => setForm({ ...form, whatsappToken: e.target.value })}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest('whatsapp')}
                      disabled={testingChannel !== null || !form.whatsappInstanceId || !form.whatsappToken || !form.whatsappPhone}
                      className="w-full gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-xs"
                    >
                      {testingChannel === 'whatsapp' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5" />
                      )}
                      Enviar Alerta de Prueba a mi WhatsApp
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* TRIGGERS & RULES TAB */}
              <TabsContent value="triggers" className="space-y-4 pt-3">
                <div className="space-y-3">
                  <div className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                          <Flame className="h-4 w-4 text-amber-500" /> Alerta de Descuento del Radar
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Notifica cuando un proveedor favorito tenga una rebaja importante.
                        </p>
                      </div>
                      <Switch
                        checked={form.notifyOnRadarDeal}
                        onCheckedChange={(v) => setForm({ ...form, notifyOnRadarDeal: v })}
                      />
                    </div>

                    {form.notifyOnRadarDeal && (
                      <div className="pt-2 flex items-center gap-2">
                        <Label className="text-xs whitespace-nowrap">Descuento Mínimo para Alertar:</Label>
                        <select
                          value={form.minDiscountPct}
                          onChange={(e) => setForm({ ...form, minDiscountPct: Number(e.target.value) })}
                          className="h-8 rounded-md border bg-background px-2 text-xs font-semibold text-primary"
                        >
                          <option value={15}>≥ 15% Descuento</option>
                          <option value={20}>≥ 20% Descuento</option>
                          <option value={25}>≥ 25% Descuento (Recomendado)</option>
                          <option value={30}>≥ 30% Mega Oferta</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                          <PackageCheck className="h-4 w-4 text-emerald-600" /> Alerta de Paquete Entregado en Miami
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Avisa de inmediato cuando USPS/UPS entregue el paquete en el casillero Shiper.
                        </p>
                      </div>
                      <Switch
                        checked={form.notifyOnMiamiDelivery}
                        onCheckedChange={(v) => setForm({ ...form, notifyOnMiamiDelivery: v })}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs">
            Cerrar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="text-xs gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Guardar Configuración
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
