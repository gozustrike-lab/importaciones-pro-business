'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Building2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Truck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';

interface ShipperVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onVerified?: () => void;
}

export function ShipperVerifyDialog({
  open,
  onOpenChange,
  products,
  onVerified,
}: ShipperVerifyDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  // Trackings que están en Miami o en tránsito para enviar a Shiper
  const eligibleProducts = useMemo(() => {
    return products.filter(
      (p) =>
        !p.isArchived &&
        ['USA', 'TRANSITO_USA'].includes(p.status) &&
        p.trackingNumber &&
        p.trackingNumber !== 'SIN_TRACKING'
    );
  }, [products]);

  // Mensaje exacto formateado como le gusta a Shiper Courier
  const whatsappMessage = useMemo(() => {
    const trackingList = eligibleProducts.map((p) => p.trackingNumber.trim()).join('\n');
    return `VERIFICAR PORFAVOR\n\n${trackingList}`;
  }, [eligibleProducts]);

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(whatsappMessage);
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 2500);
    toast({
      title: '📋 Lista copiada para WhatsApp',
      description: `Se copiaron ${eligibleProducts.length} trackings con el formato exacto de Shiper.`,
    });
  };

  const handleApplyShiperResponse = async () => {
    if (!inputText.trim()) {
      toast({
        title: 'Campo vacío',
        description: 'Pega la respuesta que te dio Shiper por WhatsApp.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/products/shipper-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la respuesta');
      }

      setVerificationResult(data);

      toast({
        title: `✅ ${data.confirmedCount} confirmado(s) en almacén`,
        description: `${data.notInSystemCount} no figura(n) aún, ${data.modifiedTrackingsCount} con tracking actualizado por almacén.`,
      });

      if (onVerified) {
        onVerified();
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error al verificar',
        description: error.message || 'No se pudo aplicar la respuesta de Shiper',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b bg-card">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <span>Validación con Shiper Courier (Miami)</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Envía tus trackings a Shiper por WhatsApp y pega su respuesta para confirmar qué está listo para embarcar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Tabs */}
        <div className="flex-1 overflow-y-auto p-5">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="send" className="text-xs gap-1.5 font-semibold">
                <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                1. Enviar Lista por WhatsApp
              </TabsTrigger>
              <TabsTrigger value="receive" className="text-xs gap-1.5 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                2. Pegar Respuesta de Shiper
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Enviar lista */}
            <TabsContent value="send" className="space-y-4 m-0">
              <div className="p-3.5 rounded-lg border bg-muted/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Truck className="h-4 w-4 text-emerald-600" />
                    Trackings en Almacén / Tránsito Miami ({eligibleProducts.length}):
                  </span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-xs">
                    Formato WhatsApp Shiper
                  </Badge>
                </div>

                <div className="p-3 rounded bg-background border font-mono text-xs max-h-48 overflow-y-auto whitespace-pre leading-relaxed select-all">
                  {whatsappMessage}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Copia esta lista y pégala en tu chat de WhatsApp con Shiper Courier.
                  </p>
                  <Button
                    onClick={handleCopyWhatsApp}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8"
                  >
                    {copiedList ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copiar para WhatsApp
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: Pegar respuesta */}
            <TabsContent value="receive" className="space-y-4 m-0">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Pega aquí la respuesta que te envió Shiper Courier:</span>
                  <span className="text-[11px] text-muted-foreground">
                    (Detecta automáticamente &quot;si figura&quot;, &quot;no figura&quot; y prefijos 420...)
                  </span>
                </label>
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ejemplo:
383588104255 si figura en sistema
9434608106244558949658 no figura en sistema
(420)331722139(94)36208106245579767610 si figura en sistema, consdierar tal cual se lo paso
383730102539 si figura en sistema"
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>

              {/* Botón de procesar */}
              <div className="flex justify-end">
                <Button
                  onClick={handleApplyShiperResponse}
                  disabled={loading || !inputText.trim()}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Validar y Actualizar Estados en Sistema
                </Button>
              </div>

              {/* Resumen del resultado */}
              {verificationResult && (
                <div className="p-3.5 rounded-lg border bg-muted/40 space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground">
                      Resultado de la validación:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge className="bg-emerald-600 text-white text-[11px]">
                        {verificationResult.confirmedCount} listos para vuelo
                      </Badge>
                      {verificationResult.notInSystemCount > 0 && (
                        <Badge variant="destructive" className="text-[11px]">
                          {verificationResult.notInSystemCount} no figura(n) aún
                        </Badge>
                      )}
                      {verificationResult.modifiedTrackingsCount > 0 && (
                        <Badge variant="outline" className="border-blue-300 text-blue-800 bg-blue-50 text-[11px]">
                          {verificationResult.modifiedTrackingsCount} tracking(s) corregido(s)
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {verificationResult.results.map((r: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-2 rounded border text-xs flex items-center justify-between gap-2 ${
                          r.confirmed
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                            : 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            {r.confirmed ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                            )}
                            <span className="font-bold">{r.baseTracking}</span>
                            {r.orderNumber && (
                              <span className="text-muted-foreground">({r.orderNumber})</span>
                            )}
                          </div>
                          {r.description && (
                            <p className="text-[11px] text-muted-foreground truncate">{r.description}</p>
                          )}
                          {r.shipperTracking && (
                            <p className="text-[10px] text-blue-700 dark:text-blue-400 font-mono font-medium">
                              👉 Tracking de Almacén: {r.shipperTracking}
                            </p>
                          )}
                        </div>

                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] font-semibold ${
                            r.confirmed
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}
                        >
                          {r.confirmed ? 'Listo para Embarcar' : 'No figura aún'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-card flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>

          {activeTab === 'send' && (
            <Button
              size="sm"
              onClick={() => setActiveTab('receive')}
              className="gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs"
            >
              Ya tengo la respuesta de Shiper <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}

          {activeTab === 'receive' && verificationResult && (
            <Button
              size="sm"
              onClick={() => onOpenChange(false)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
            >
              <Check className="h-3.5 w-3.5" />
              Listo, volver al Inventario
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
