'use client';

import { useState } from 'react';
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
  Archive,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
  Bookmark,
  CheckCircle2,
  Building2,
  Truck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SyncHiddenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncCompleted?: () => void;
}

export function SyncHiddenDialog({
  open,
  onOpenChange,
  onSyncCompleted,
}: SyncHiddenDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'delivery' | 'archive' | 'bookmarklet'>('delivery');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedDeliveryBookmarklet, setCopiedDeliveryBookmarklet] = useState(false);
  const [copiedArchiveBookmarklet, setCopiedArchiveBookmarklet] = useState(false);

  // Extraer números de orden de eBay (formato ##-#####-#####) del texto pegado
  const detectedOrders = Array.from(
    new Set(Array.from(inputText.matchAll(/\b\d{2}-\d{5}-\d{5}\b/g)).map((m) => m[0]))
  );

  // Código JavaScript del Bookmarklet 1: Marcar Llegados a Miami
  const bookmarkletDeliveryCode = `javascript:(function(){const orders=Array.from(new Set(Array.from(document.body.innerText.matchAll(/\\b\\d{2}-\\d{5}-\\d{5}\\b/g)).map(m=>m[0])));if(!orders.length){alert('No se encontraron órdenes de compra en esta página de eBay.');return;}if(!confirm('Se encontraron '+orders.length+' órdenes de compra en esta página.\\n\\n¿Deseas marcar estas órdenes como LLEGADAS AL ALMACÉN MIAMI en tu sistema local?'))return;fetch('http://localhost:3000/api/products/delivery-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumbers:orders})}).then(r=>r.json()).then(d=>{alert('✅ ¡Sincronizado con éxito!\\n\\nSe marcaron '+d.updatedCount+' productos en Almacén Miami.');}).catch(e=>{alert('Error de conexión con tu sistema local:\\n'+e.message+'\\nAsegúrate de que localhost:3000 esté abierto.');});})();`;

  // Código JavaScript del Bookmarklet 2: Archivar Ocultos
  const bookmarkletArchiveCode = `javascript:(function(){const orders=Array.from(new Set(Array.from(document.body.innerText.matchAll(/\\b\\d{2}-\\d{5}-\\d{5}\\b/g)).map(m=>m[0])));if(!orders.length){alert('No se encontraron órdenes de compra en esta página de eBay.');return;}if(!confirm('Se encontraron '+orders.length+' órdenes de compra en esta página.\\n\\n¿Deseas archivarlas automáticamente en tu sistema local?'))return;fetch('http://localhost:3000/api/products/archive-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumbers:orders,isArchived:true})}).then(r=>r.json()).then(d=>{alert('✅ ¡Sincronizado con éxito!\\n\\nSe archivaron '+d.updatedCount+' productos en tu sistema local.');window.location.reload();}).catch(e=>{alert('Error de conexión con tu sistema local:\\n'+e.message+'\\nAsegúrate de que localhost:3000 esté abierto.');});})();`;

  const handleCopyBookmarklet = (type: 'delivery' | 'archive') => {
    const code = type === 'delivery' ? bookmarkletDeliveryCode : bookmarkletArchiveCode;
    navigator.clipboard.writeText(code);
    if (type === 'delivery') {
      setCopiedDeliveryBookmarklet(true);
      setTimeout(() => setCopiedDeliveryBookmarklet(false), 2500);
    } else {
      setCopiedArchiveBookmarklet(true);
      setTimeout(() => setCopiedArchiveBookmarklet(false), 2500);
    }
    toast({
      title: '📋 Código copiado',
      description: 'Pega este código en la URL de un marcador de tu navegador Chrome.',
    });
  };

  const handleMarkDelivered = async () => {
    if (detectedOrders.length === 0) return;

    try {
      setLoading(true);
      const res = await fetch('/api/products/delivery-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumbers: detectedOrders,
          arrivalDate: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar llegadas a Miami');
      }

      toast({
        title: `🏢 ${data.updatedCount} producto(s) en Almacén Miami`,
        description: `Se actualizaron ${detectedOrders.length} órdenes al estado "En Almacén Miami" con fecha de hoy.`,
      });

      setInputText('');
      if (onSyncCompleted) {
        onSyncCompleted();
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error al sincronizar llegadas',
        description: error.message || 'No se pudieron actualizar los productos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveOrders = async () => {
    if (detectedOrders.length === 0) return;

    try {
      setLoading(true);
      const res = await fetch('/api/products/archive-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumbers: detectedOrders,
          isArchived: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al archivar órdenes');
      }

      toast({
        title: `📦 ${data.updatedCount} producto(s) archivados`,
        description: `Se sincronizaron ${detectedOrders.length} órdenes y se movieron a "Archivados" en tu sistema.`,
      });

      setInputText('');
      if (onSyncCompleted) {
        onSyncCompleted();
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error al sincronizar',
        description: error.message || 'No se pudieron archivar las órdenes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeepOnlyActive = async () => {
    if (detectedOrders.length === 0) return;

    try {
      setLoading(true);
      const res = await fetch('/api/products/archive-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumbers: detectedOrders,
          keepOnlyActive: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al sincronizar activos');
      }

      toast({
        title: `✨ Inventario Sincronizado (${data.activeKeptCount} Activos)`,
        description: `Se mantuvieron exactamente tus ${data.activeKeptCount} compras activas de eBay y se movieron ${data.archivedCount} al archivo.`,
      });

      setInputText('');
      if (onSyncCompleted) {
        onSyncCompleted();
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error en Modo Espejo',
        description: error.message || 'No se pudo sincronizar la lista de activos',
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
                <span>Sincronizador Inteligente eBay & Almacén Miami</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Actualiza estados de paquetes entregados en Miami o archiva compras ya embarcadas en 1 clic.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Tabs */}
        <div className="flex-1 overflow-y-auto p-5">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="delivery" className="text-xs gap-1.5 font-semibold">
                <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                Llegados a Miami
              </TabsTrigger>
              <TabsTrigger value="archive" className="text-xs gap-1.5 font-semibold">
                <Archive className="h-3.5 w-3.5 text-slate-600" />
                Archivar Ocultos
              </TabsTrigger>
              <TabsTrigger value="bookmarklet" className="text-xs gap-1.5 font-semibold">
                <Bookmark className="h-3.5 w-3.5 text-blue-600" />
                Marcador Chrome
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Marcar Llegados a Miami */}
            <TabsContent value="delivery" className="space-y-4 m-0">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Pega órdenes o texto de eBay con los productos que ya llegaron:</span>
                  <a
                    href="https://www.ebay.com/mye/myebay/purchase"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1 font-normal"
                  >
                    Abrir eBay Compras <ExternalLink className="h-3 w-3" />
                  </a>
                </label>
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ejemplo:
22-15154-01688
23-15161-07326

(O selecciona el texto de las compras entregadas en tu pantalla de eBay y pégalo aquí)"
                  rows={5}
                  className="font-mono text-xs"
                />
              </div>

              {/* Resultados detectados */}
              <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    Órdenes detectadas automáticamente:
                  </span>
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs ${
                      detectedOrders.length > 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {detectedOrders.length} orden{detectedOrders.length !== 1 ? 'es' : ''}
                  </Badge>
                </div>

                {detectedOrders.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-background rounded border">
                    {detectedOrders.map((ord) => (
                      <Badge key={ord} variant="secondary" className="font-mono text-[11px] gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {ord}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    Pega texto arriba. El sistema reconocerá automáticamente los números de orden de eBay (ej: <code>22-15154-01688</code>).
                  </p>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: Archivar Ocultos / Modo Espejo */}
            <TabsContent value="archive" className="space-y-4 m-0">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Pega el texto de tus páginas de Compras en eBay (Ctrl+A y Ctrl+C):</span>
                  <a
                    href="https://www.ebay.com/mye/myebay/purchase"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1 font-normal"
                  >
                    Abrir eBay Compras <ExternalLink className="h-3 w-3" />
                  </a>
                </label>
                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="¡Súper fácil!
1. En eBay Purchase History (Página 1 y Página 2 de tus compras activas), presiona Ctrl+A (seleccionar todo) y Ctrl+C (copiar).
2. Pégalo aquí con Ctrl+V.
3. Haz clic abajo en '✨ Dejar SOLO estas como Activas' para que tu sistema quede 100% idéntico a tus compras activas de eBay."
                  rows={5}
                  className="font-mono text-xs"
                />
              </div>

              {/* Resultados detectados */}
              <div className="p-3 rounded-lg border bg-muted/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    Órdenes detectadas en el texto pegado:
                  </span>
                  <Badge
                    variant="outline"
                    className={`font-mono text-xs ${
                      detectedOrders.length > 0
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {detectedOrders.length} orden{detectedOrders.length !== 1 ? 'es' : ''}
                  </Badge>
                </div>

                {detectedOrders.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-background rounded border">
                    {detectedOrders.map((ord) => (
                      <Badge key={ord} variant="secondary" className="font-mono text-[11px] gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        {ord}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    Pega aquí el texto de tus 2 páginas de compras activas de eBay para dejar exactamente tus 32 activos.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: Bookmarklets Chrome */}
            <TabsContent value="bookmarklet" className="space-y-4 m-0">
              <div className="p-4 rounded-lg border bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 space-y-3 text-xs text-blue-950 dark:text-blue-200">
                <div className="flex items-center gap-2 font-bold text-sm text-blue-900 dark:text-blue-300">
                  <Bookmark className="h-4 w-4" />
                  <span>Marcadores Directos para Chrome (1 Clic desde eBay)</span>
                </div>
                <p className="text-xs leading-relaxed">
                  Guarda estos marcadores en la barra de favoritos de tu Chrome. Cuando estés en eBay, haces 1 solo clic y actualizarás tu sistema local al instante:
                </p>

                <div className="space-y-2.5 pt-1">
                  {/* Marcador 1: Llegados a Miami */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border gap-2">
                    <div>
                      <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                        Marcador: Actualizar Llegados a Almacén Miami
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Lee las órdenes en pantalla de eBay y las marca como recibidas en Miami.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyBookmarklet('delivery')}
                      className="shrink-0 gap-1 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    >
                      {copiedDeliveryBookmarklet ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      Copiar Marcador
                    </Button>
                  </div>

                  {/* Marcador 2: Archivar Ocultos */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border gap-2">
                    <div>
                      <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        <Archive className="h-3.5 w-3.5 text-slate-600" />
                        Marcador: Archivar Ocultos de eBay
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        En la página &quot;Hidden items&quot; de eBay, archiva todo en tu base de datos local.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyBookmarklet('archive')}
                      className="shrink-0 gap-1 text-xs border-slate-300 text-slate-800 hover:bg-slate-50"
                    >
                      {copiedArchiveBookmarklet ? <Check className="h-3.5 w-3.5 text-slate-600" /> : <Copy className="h-3.5 w-3.5" />}
                      Copiar Marcador
                    </Button>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground pt-1 space-y-1">
                  <p><strong>¿Cómo instalarlo en Chrome?</strong></p>
                  <p>1. Copia el código con el botón de arriba.</p>
                  <p>2. Presiona <strong>Ctrl+D</strong> para crear un marcador, nómbralo y en el campo <strong>URL</strong> pega el código.</p>
                  <p>3. En tu pestaña de compras de eBay, haz clic en el marcador. ¡Listo!</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-card flex items-center justify-between flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>

          {activeTab === 'delivery' && (
            <Button
              size="sm"
              onClick={handleMarkDelivered}
              disabled={loading || detectedOrders.length === 0}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Building2 className="h-3.5 w-3.5" />}
              Marcar {detectedOrders.length} como Llegados a Miami
            </Button>
          )}

          {activeTab === 'archive' && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleArchiveOrders}
                disabled={loading || detectedOrders.length === 0}
                className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                Archivar estas {detectedOrders.length}
              </Button>
              <Button
                size="sm"
                onClick={handleKeepOnlyActive}
                disabled={loading || detectedOrders.length === 0}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                ✨ Dejar SOLO estas {detectedOrders.length} como Activas
              </Button>
            </div>
          )}

          {activeTab === 'bookmarklet' && (
            <p className="text-xs text-muted-foreground">
              Usa los botones de arriba para copiar el marcador deseado a Chrome.
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
