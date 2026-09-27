'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileSpreadsheet,
  Download,
  Check,
  ExternalLink,
  AlertTriangle,
  Package,
  Trash2,
  Save,
  Loader2,
  Building2,
  Sparkles,
  Info,
  Archive,
  Mail,
  Copy,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/lib/types';
import {
  autoClassifyProduct,
  sanitizeSunatModel,
} from '@/lib/shipper-classification';

interface EmbarqueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: Product[];
  onProductsUpdated?: () => void;
  onClearSelection?: () => void;
}

export interface EditableItem {
  productId: string;
  orderNumber: string;
  rawDescription: string;
  contenidoGeneral: string; // Título exacto tal como aparece en el inventario para la Hoja de Embarque
  trackingNumber: string;
  shipperTracking?: string;
  shipperConfirmed?: boolean;
  courier: string;
  // Campos Aduanas / Declaración SUNAT
  productoNombre: string;
  marca: string;
  modelo: string; // Estrictamente código técnico A#### (ej: A1701, A2200), o vacío si no se indicó
  cantidad: number;
  estado: string; // Por defecto siempre 'Usado'
  paisFabricacion: string;
  valorUsd: number;
  // Perfil SUNAT
  importerProfile: 'fabio' | 'peggy';
  dniRuc: string;
  consignatario: string;
  itemUrl?: string;
}

const FABIO_RUC = '10762026835';
const FABIO_NAME = 'FABIO CESAR HERRERA BONILLA';

const PEGGY_RUC = '10091870911';
const PEGGY_NAME = 'BONILLA ORDUÑA PEGGY LILIANA';

export function EmbarqueDialog({
  open,
  onOpenChange,
  selectedProducts,
  onProductsUpdated,
  onClearSelection,
}: EmbarqueDialogProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<EditableItem[]>([]);
  const [globalProfile, setGlobalProfile] = useState<'individual' | 'fabio' | 'peggy'>('individual');
  const [awbNumber, setAwbNumber] = useState('');
  const [downloadingEmbarque, setDownloadingEmbarque] = useState(false);
  const [downloadingTraduccion, setDownloadingTraduccion] = useState(false);
  const [savingModels, setSavingModels] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [autoArchiveOnDownload, setAutoArchiveOnDownload] = useState(true);

  // Inicializar items cuando se abre o cambian los productos seleccionados
  useEffect(() => {
    if (!open) return;

    const initialItems: EditableItem[] = selectedProducts.map((p) => {
      const classified = autoClassifyProduct({
        description: p.description,
        category: p.category,
        model: p.model,
        condition: p.condition,
        quantity: p.quantity,
        supplier: p.supplier,
        orderNumber: p.orderNumber,
      });

      // Modelo: Solo si explícitamente existe en el título como A#### o fue guardado manualmente por el usuario
      const cleanModel = sanitizeSunatModel(p.model) || classified.modelo || '';

      const isPeggy = p.importerProfile === 'peggy';
      const dniRuc = isPeggy ? PEGGY_RUC : FABIO_RUC;
      const consignatario = isPeggy ? PEGGY_NAME : FABIO_NAME;

      return {
        productId: p.id,
        orderNumber: p.orderNumber,
        rawDescription: p.description,
        contenidoGeneral: p.description, // Título exacto tal como aparece en inventario
        trackingNumber: p.trackingNumber || '',
        shipperTracking: p.shipperTracking || '',
        shipperConfirmed: p.shipperConfirmed ?? false,
        courier: p.courier || 'USPS',
        productoNombre: classified.productoNombre,
        marca: classified.marca || 'Apple',
        modelo: cleanModel,
        cantidad: p.quantity && p.quantity > 0 ? p.quantity : 1,
        estado: 'Usado', // Por defecto todos son productos usados según requerimiento
        paisFabricacion: 'CHINA',
        valorUsd: p.orderTotalUSD ?? (p.purchasePriceUSD + (p.shippingCostUSD || 0)),
        importerProfile: isPeggy ? 'peggy' : 'fabio',
        dniRuc,
        consignatario,
        itemUrl: p.itemUrl || (p.itemId ? `https://www.ebay.com/itm/${p.itemId}` : undefined),
      };
    });

    setItems(initialItems);
  }, [open, selectedProducts]);

  // Aplicar cambio de perfil global
  const handleGlobalProfileChange = (val: 'individual' | 'fabio' | 'peggy') => {
    setGlobalProfile(val);
    if (val === 'individual') return;

    setItems((prev) =>
      prev.map((it) => ({
        ...it,
        importerProfile: val,
        dniRuc: val === 'peggy' ? PEGGY_RUC : FABIO_RUC,
        consignatario: val === 'peggy' ? PEGGY_NAME : FABIO_NAME,
      }))
    );
  };

  // Actualizar un campo de un ítem
  const updateItemField = <K extends keyof EditableItem>(
    index: number,
    field: K,
    value: EditableItem[K]
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Autoguardado en tiempo real en PostgreSQL
  const [autoSavingId, setAutoSavingId] = useState<string | null>(null);
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string | null>(null);

  const saveSingleItemToDb = async (item: EditableItem) => {
    try {
      setAutoSavingId(item.productId);
      const cleanModel = sanitizeSunatModel(item.modelo);
      await fetch(`/api/products/${item.productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cleanModel,
          quantity: Number(item.cantidad) || 1,
          condition: item.estado,
          importerProfile: item.importerProfile,
          recipientName: item.consignatario,
        }),
      });
      setLastAutoSavedTime(new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      if (onProductsUpdated) {
        onProductsUpdated();
      }
    } catch (err) {
      console.error('Error autosaving to DB:', err);
    } finally {
      setTimeout(() => setAutoSavingId(null), 800);
    }
  };

  // Sanitizar modelo en tiempo de edición y autoguardar
  const handleModelBlur = (index: number) => {
    const item = items[index];
    const cleanModel = sanitizeSunatModel(item.modelo);
    const updated = {
      ...item,
      modelo: cleanModel,
    };
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });

    // Autoguardar en BD en tiempo real
    saveSingleItemToDb(updated);
  };

  // Cambiar perfil de un ítem individual y autoguardar
  const updateItemProfile = (index: number, profile: 'fabio' | 'peggy') => {
    const item = items[index];
    const updated = {
      ...item,
      importerProfile: profile,
      dniRuc: profile === 'peggy' ? PEGGY_RUC : FABIO_RUC,
      consignatario: profile === 'peggy' ? PEGGY_NAME : FABIO_NAME,
    };
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });

    // Autoguardar en BD en tiempo real
    saveSingleItemToDb(updated);
  };

  // Quitar un ítem de la selección
  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Totales calculados en vivo
  const totals = useMemo(() => {
    const totalUnits = items.reduce((acc, it) => acc + (Number(it.cantidad) || 1), 0);
    const totalFob = items.reduce((acc, it) => acc + (Number(it.valorUsd) || 0), 0);
    const fabioFob = items
      .filter((it) => it.importerProfile === 'fabio')
      .reduce((acc, it) => acc + (Number(it.valorUsd) || 0), 0);
    const peggyFob = items
      .filter((it) => it.importerProfile === 'peggy')
      .reduce((acc, it) => acc + (Number(it.valorUsd) || 0), 0);
    const missingModelsCount = items.filter((it) => !it.modelo.trim()).length;

    return {
      packagesCount: items.length,
      totalUnits,
      totalFob,
      fabioFob,
      peggyFob,
      isUnder200: totalFob <= 200.0,
      missingModelsCount,
    };
  }, [items]);

  // 1. Descargar Hoja de Embarque
  const handleDownloadEmbarque = async () => {
    if (items.length === 0) {
      toast({ title: 'Sin ítems', description: 'No hay productos para exportar', variant: 'destructive' });
      return;
    }

    try {
      setDownloadingEmbarque(true);
      const payload = {
        items: items.map((it) => ({
          proveedor: 'EBAY',
          dniRuc: it.dniRuc,
          consignatario: it.consignatario,
          courier: (it.courier || 'UPS').toUpperCase(),
          trackingUsa: (it.shipperTracking || it.trackingNumber || '').trim(),
          // Contenido General: Nombre exacto de cada producto tal cual aparece en inventario
          contenidoGeneral: (it.contenidoGeneral || it.rawDescription || '').trim(),
          paisFabricacion: (it.paisFabricacion || 'CHINA').toUpperCase(),
          valorUsd: Number(it.valorUsd) || 0,
          // Indicaciones: Estrictamente en blanco para temas administrativos del courier
          indicaciones: '',
          itemUrl: it.itemUrl,
        })),
        ruc: globalProfile === 'peggy' ? PEGGY_RUC : FABIO_RUC,
        name: globalProfile === 'peggy' ? PEGGY_NAME : FABIO_NAME,
      };

      const res = await fetch('/api/shipper/embarque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al generar la orden de embarque');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `SHIPER_ORDEN_DE_EMBARQUE_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (autoArchiveOnDownload) {
        // 1. Archivar productos con fecha actual
        await fetch('/api/products/archive-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productIds: items.map((it) => it.productId),
            isArchived: true,
          }),
        });

        // 2. Registrar Expediente de Embarque en Bitácora & Shipper
        const isPeggy =
          globalProfile === 'peggy' ||
          (globalProfile === 'individual' && items[0]?.importerProfile === 'peggy');
        const profile = isPeggy ? 'peggy' : 'fabio';
        const consigneeName = profile === 'peggy' ? PEGGY_NAME : FABIO_NAME;
        const consigneeRuc = profile === 'peggy' ? PEGGY_RUC : FABIO_RUC;

        await fetch('/api/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flightDate: new Date(),
            importerProfile: profile,
            consigneeName,
            consigneeRuc,
            productIds: items.map((it) => it.productId),
            awbNumber: awbNumber.trim(),
            fallbackFobUsd: totals.totalFob,
            notes: `Embarque de ${items.length} productos hacia Lima`,
          }),
        }).catch((err) => console.error('Error auto-registrando embarque en bitácora:', err));

        toast({
          title: '📥 Hoja de Embarque descargada y registrada',
          description: `Se descargó el Excel, se archivaron ${items.length} productos y se creó el expediente en "Bitácora & Shipper" para su seguimiento a Lima.`,
        });

        if (onProductsUpdated) {
          onProductsUpdated();
        }
        if (onClearSelection) {
          onClearSelection();
        }
        onOpenChange(false);
      } else {
        toast({
          title: '📥 Hoja de Embarque descargada',
          description: `Se generó el Excel con ${items.length} productos usando el formato oficial de Shipper.`,
        });
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error al exportar',
        description: error.message || 'No se pudo generar el archivo Excel de embarque',
        variant: 'destructive',
      });
    } finally {
      setDownloadingEmbarque(false);
    }
  };

  // 2. Descargar Hoja de Traducción SUNAT (Declaración Jurada)
  const handleDownloadTraduccion = async () => {
    if (items.length === 0) {
      toast({ title: 'Sin ítems', description: 'No hay productos para exportar', variant: 'destructive' });
      return;
    }

    // Validación estricta para evitar Canal Naranja/Rojo en Aduanas
    const missing = items.filter((it) => !it.modelo.trim());
    if (missing.length > 0) {
      toast({
        title: `⚠️ Falta ingresar Modelo en ${missing.length} producto(s)`,
        description: 'Aduanas SUNAT exige el modelo técnico exacto (ej: A1701). Por favor complétalo en la columna resaltada en amarillo antes de descargar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setDownloadingTraduccion(true);
      const payload = {
        awbNumber: awbNumber.trim(),
        items: items.map((it) => ({
          productoNombre: it.productoNombre || 'Tableta Electrónica',
          marca: it.marca || 'Apple',
          // Modelo: ESTRICTAMENTE solo el código A#### (ej: A1701)
          modelo: sanitizeSunatModel(it.modelo),
          paisFabricacion: (it.paisFabricacion || 'CHINA').toUpperCase(),
          cantidad: Number(it.cantidad) || 1,
          estado: 'Usado',
          // Factura: Número de orden de compra en eBay (ej: 25-15141-56007)
          numeroFactura: it.orderNumber,
          numeroOperacion: '', // En blanco
        })),
      };

      const res = await fetch('/api/shipper/traduccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al generar la traducción de factura');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `DECLARACION_JURADA_TRADUCCION_SUNAT_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: '📥 Traducción SUNAT descargada',
        description: `Formato oficial Arial 14 Negrita generado para ${items.length} productos.`,
      });
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error al exportar',
        description: error.message || 'No se pudo generar la traducción de factura SUNAT',
        variant: 'destructive',
      });
    } finally {
      setDownloadingTraduccion(false);
    }
  };

  // 3. Descargar Ambos Archivos
  const handleDownloadBoth = async () => {
    // Si falta modelo, avisar antes
    const missing = items.filter((it) => !it.modelo.trim());
    if (missing.length > 0) {
      toast({
        title: `⚠️ Falta ingresar Modelo en ${missing.length} producto(s)`,
        description: 'Aduanas SUNAT exige el modelo técnico (ej: A1701). Por favor complétalo antes de descargar.',
        variant: 'destructive',
      });
      return;
    }
    await handleDownloadEmbarque();
    await handleDownloadTraduccion();
  };

  // 4. Guardar Modelos y Cantidades en PostgreSQL
  const handleSaveToDatabase = async () => {
    if (items.length === 0) return;

    try {
      setSavingModels(true);
      const promises = items.map((it) =>
        fetch(`/api/products/${it.productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: sanitizeSunatModel(it.modelo), // Guarda solo el código limpio A#### o vacío
            quantity: Number(it.cantidad) || 1,
            condition: it.estado,
            importerProfile: it.importerProfile,
            recipientName: it.consignatario,
          }),
        })
      );

      await Promise.all(promises);

      toast({
        title: '💾 Modelos guardados en BD',
        description: `Se guardaron los modelos y cantidades en PostgreSQL.`,
      });

      if (onProductsUpdated) {
        onProductsUpdated();
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error al guardar',
        description: error.message || 'No se pudieron actualizar los productos en la base de datos',
        variant: 'destructive',
      });
    } finally {
      setSavingModels(false);
    }
  };

  // 5. Copiar Texto del Correo de Embarque para Shiper
  const handleCopyEmailDraft = () => {
    const isPeggy =
      globalProfile === 'peggy' ||
      (globalProfile === 'individual' && items[0]?.importerProfile === 'peggy');
    const profileName = isPeggy ? PEGGY_NAME : FABIO_NAME;
    const profileRuc = isPeggy ? PEGGY_RUC : FABIO_RUC;

    // Detectar trackings que fueron modificados por el almacén (ej: prefijo 420...)
    const altered = items.filter(
      (it) => it.shipperTracking && it.shipperTracking !== it.trackingNumber
    );

    let text = `Estimado equipo de Shiper Courier,\n\n`;
    text += `Adjunto la Orden de Embarque y la Hoja de Traducción SUNAT correspondiente para el próximo vuelo hacia Lima, Perú.\n\n`;
    text += `📌 DATOS DEL EMBARQUE:\n`;
    text += `- Consignatario: ${profileName}\n`;
    text += `- RUC: ${profileRuc}\n`;
    text += `- Total de Paquetes: ${items.length} bulto(s)\n`;
    text += `- Total Unidades: ${totals.totalUnits} equipo(s)\n`;
    text += `- Valor Total FOB: $${totals.totalFob.toFixed(2)} USD\n\n`;

    if (altered.length > 0) {
      text += `⚠️ NOTA IMPORTANTE - TRACKINGS REGISTRADOS POR SU ALMACÉN:\n`;
      text += `Por favor tomar en cuenta los siguientes trackings tal como fueron registrados en su sistema de almacén:\n`;
      altered.forEach((it, idx) => {
        text += `${idx + 1}. Tracking original: ${it.trackingNumber} ➔ Registrado en almacén: ${it.shipperTracking} (${it.productoNombre} - ${it.modelo || 'Sin modelo'})\n`;
      });
      text += `\n`;
    }

    text += `Quedo a la espera de la confirmación de embarque y el número de guía (AWB) correspondiente.\n\n`;
    text += `Muchas gracias y saludos cordiales,\n${profileName}`;

    navigator.clipboard.writeText(text);
    toast({
      title: '📧 Correo de Embarque copiado',
      description: 'Texto listo para pegar en el cuerpo de tu correo a Shiper Courier.',
    });
  };

  // 5. Marcar productos como Ya Embarcados (Archivar)
  const handleArchiveItems = async () => {
    if (items.length === 0) return;

    const confirmArchive = window.confirm(
      `¿Deseas marcar estos ${items.length} productos como YA EMBARCADOS a Perú?\n\nSe moverán a la sección de "Archivados" para que no vuelvan a aparecer en el inventario activo ni se vuelvan a embarcar por error.`
    );
    if (!confirmArchive) return;

    try {
      setArchiving(true);
      await fetch('/api/products/archive-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: items.map((it) => it.productId),
          isArchived: true,
        }),
      });

      // Auto-register in Bitácora & Shipper
      const isPeggy =
        globalProfile === 'peggy' ||
        (globalProfile === 'individual' && items[0]?.importerProfile === 'peggy');
      const profile = isPeggy ? 'peggy' : 'fabio';
      const consigneeName = profile === 'peggy' ? PEGGY_NAME : FABIO_NAME;
      const consigneeRuc = profile === 'peggy' ? PEGGY_RUC : FABIO_RUC;

      await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flightDate: new Date(),
          importerProfile: profile,
          consigneeName,
          consigneeRuc,
          productIds: items.map((it) => it.productId),
          awbNumber: awbNumber.trim(),
          fallbackFobUsd: totals.totalFob,
          notes: `Embarque archivado manualmente (${items.length} productos)`,
        }),
      }).catch((err) => console.error('Error auto-registrando embarque:', err));

      toast({
        title: '📦 Productos Archivados y Registrados en Bitácora',
        description: `Se movieron ${items.length} productos a Archivados y se creó el seguimiento en "Bitácora & Shipper".`,
      });

      if (onProductsUpdated) {
        onProductsUpdated();
      }
      if (onClearSelection) {
        onClearSelection();
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error al archivar',
        description: error.message || 'No se pudieron archivar los productos seleccionados',
        variant: 'destructive',
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] xl:max-w-7xl max-h-[94vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 border-b bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>Hoja de Embarque Shipper & Traducción SUNAT</span>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    Plantillas Oficiales
                  </Badge>
                  {totals.missingModelsCount > 0 && (
                    <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-xs">
                      ⚠️ {totals.missingModelsCount} sin modelo
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Generación exacta conforme a normativa aduanera SUNAT y casillero Shipper Miami.
                </DialogDescription>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-semibold">
                {autoSavingId ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                    <span>Guardando en BD...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span>Autoguardado en BD activo</span>
                    {lastAutoSavedTime && (
                      <span className="text-[10px] text-emerald-600/70 font-mono">({lastAutoSavedTime})</span>
                    )}
                  </>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveToDatabase}
                disabled={savingModels || items.length === 0}
                className="gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 font-semibold"
              >
                {savingModels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Guardar Modelos en BD
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleArchiveItems}
                disabled={archiving || items.length === 0}
                className="gap-1.5 text-xs border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 font-semibold"
                title="Mover estos productos a Archivados (ya no se volverán a embarcar)"
              >
                {archiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5 text-slate-600" />}
                Marcar Ya Embarcados
              </Button>
            </div>
          </div>

          {/* Quick Profile & AWB Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
            {/* Titular SUNAT Selector */}
            <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/40">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <Label className="text-[11px] text-muted-foreground block">Consignatario General:</Label>
                <Select value={globalProfile} onValueChange={(v: any) => handleGlobalProfileChange(v)}>
                  <SelectTrigger className="h-7 text-xs border-0 bg-transparent p-0 focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Respetar titular de cada producto</SelectItem>
                    <SelectItem value="fabio">Fabio César (RUC 10762026835)</SelectItem>
                    <SelectItem value="peggy">Peggy Liliana (RUC 10091870911)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* AWB Guide Number */}
            <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/40">
              <Package className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <Label className="text-[11px] text-muted-foreground block">Guía AWB Shipper (opcional):</Label>
                <Input
                  value={awbNumber}
                  onChange={(e) => setAwbNumber(e.target.value)}
                  placeholder="ej: AWB-2026-09"
                  className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 font-mono"
                />
              </div>
            </div>

            {/* Live Financial Indicator */}
            <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/40 text-xs">
              <div>
                <span className="text-[11px] text-muted-foreground block">Total FOB Declarado:</span>
                <span className="font-bold text-sm text-foreground">${totals.totalFob.toFixed(2)} USD</span>
                <span className="text-[11px] text-muted-foreground ml-1">({totals.totalUnits} unids)</span>
              </div>
              <div>
                {totals.isUnder200 ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[11px] gap-1 font-semibold">
                    <Check className="h-3 w-3" />
                    &lt; $200 USD (Exonerado)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[11px] gap-1 font-semibold">
                    <AlertTriangle className="h-3 w-3" />
                    &gt; $200 USD (Revisar)
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Normativa Aduanera Notice */}
          <div className="mt-2.5 p-2 rounded-md bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-[11px] text-blue-900 dark:text-blue-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>
                <strong>Control de Aduanas:</strong> Solo se autocompleta el Modelo si aparece explícitamente en el título como <code>A####</code>. Si no aparece, queda en blanco para que lo revises e ingreses manualmente antes de emitir la Traducción.
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Items Table */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto opacity-40 mb-2" />
              <p className="text-sm font-medium">No hay productos seleccionados para declarar.</p>
              <p className="text-xs mt-1">Selecciona productos con el casillero en la tabla de inventario.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/60 text-xs">
                  <TableRow>
                    <TableHead className="w-[45px] text-center">#</TableHead>
                    <TableHead className="w-[180px]">
                      <span>Contenido Embarque (Shipper)</span>
                      <span className="block text-[10px] font-normal text-muted-foreground">Título exacto eBay / Factura</span>
                    </TableHead>
                    <TableHead className="w-[65px] text-center">Cant.</TableHead>
                    <TableHead className="w-[145px]">
                      <span className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-bold">
                        <Sparkles className="h-3.5 w-3.5" />
                        Modelo (SUNAT)
                      </span>
                      <span className="block text-[10px] font-normal text-blue-600/80">Solo código (ej: A1701)</span>
                    </TableHead>
                    <TableHead className="w-[170px]">Producto (Nombre Traducción)</TableHead>
                    <TableHead className="w-[85px]">Marca</TableHead>
                    <TableHead className="w-[95px]">Estado</TableHead>
                    <TableHead className="w-[75px]">País Fab.</TableHead>
                    <TableHead className="w-[130px]">Courier & Tracking</TableHead>
                    <TableHead className="w-[90px] text-right">Valor USD</TableHead>
                    <TableHead className="w-[115px]">Titular RUC</TableHead>
                    <TableHead className="w-[40px] text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {items.map((item, idx) => {
                    const hasModel = Boolean(item.modelo.trim());
                    const isValidSunatModel = /^A\d{4}$/i.test(item.modelo.trim());

                    return (
                      <TableRow key={item.productId} className="hover:bg-muted/30">
                        {/* # */}
                        <TableCell className="text-center font-bold font-mono text-muted-foreground">
                          {idx + 1}
                        </TableCell>

                        {/* Contenido General / Título Exacto eBay */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <span className="font-semibold text-foreground">{item.orderNumber}</span>
                              {item.itemUrl && (
                                <a
                                  href={item.itemUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-orange-600 hover:text-orange-700"
                                  title="Ver publicación original en eBay"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <Input
                              value={item.contenidoGeneral}
                              onChange={(e) => updateItemField(idx, 'contenidoGeneral', e.target.value)}
                              className="h-7 text-[11px] leading-tight"
                              title="Nombre exacto del producto tal como se declaró en eBay para Shipper Miami"
                            />
                          </div>
                        </TableCell>

                        {/* Cantidad */}
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={1}
                            max={99}
                            value={item.cantidad}
                            onChange={(e) => updateItemField(idx, 'cantidad', parseInt(e.target.value, 10) || 1)}
                            className="h-8 w-14 text-center font-bold text-xs p-1"
                          />
                        </TableCell>

                        {/* Modelo Técnico (SUNAT) - EDITABLE */}
                        <TableCell>
                          <div className="space-y-1">
                            <Input
                              value={item.modelo}
                              onChange={(e) => updateItemField(idx, 'modelo', e.target.value)}
                              onBlur={() => handleModelBlur(idx)}
                              placeholder="ej: A1701"
                              className={`h-8 text-xs font-mono font-bold text-center ${
                                isValidSunatModel
                                  ? 'bg-blue-50/70 text-blue-900 border-blue-400 dark:bg-blue-950/40 dark:text-blue-200'
                                  : hasModel
                                  ? 'bg-amber-50 text-amber-900 border-amber-400 dark:bg-amber-950/40 dark:text-amber-200'
                                  : 'bg-red-50 text-red-900 border-red-300 dark:bg-red-950/40 dark:text-red-200'
                              }`}
                            />
                            <div className="flex justify-center">
                              {isValidSunatModel ? (
                                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                  <Check className="h-2.5 w-2.5" /> Modelo SUNAT
                                </span>
                              ) : hasModel ? (
                                <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Solo código (A####)
                                </span>
                              ) : (
                                <span className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
                                  ⚠️ Ingresar A####
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Producto Nombre (Aduanas) */}
                        <TableCell>
                          <Input
                            value={item.productoNombre}
                            onChange={(e) => updateItemField(idx, 'productoNombre', e.target.value)}
                            className="h-8 text-xs font-medium"
                          />
                        </TableCell>

                        {/* Marca */}
                        <TableCell>
                          <Input
                            value={item.marca}
                            onChange={(e) => updateItemField(idx, 'marca', e.target.value)}
                            className="h-8 text-xs font-medium text-center"
                          />
                        </TableCell>

                        {/* Estado */}
                        <TableCell>
                          <Select
                            value={item.estado}
                            onValueChange={(val) => updateItemField(idx, 'estado', val)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Usado">Usado</SelectItem>
                              <SelectItem value="Nuevo">Nuevo</SelectItem>
                              <SelectItem value="Reacondicionado">Reacondicionado</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* País Fabricación */}
                        <TableCell>
                          <Input
                            value={item.paisFabricacion}
                            onChange={(e) => updateItemField(idx, 'paisFabricacion', e.target.value.toUpperCase())}
                            className="h-8 text-xs text-center font-mono"
                          />
                        </TableCell>

                        {/* Courier & Tracking */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                                {item.courier}
                              </Badge>
                              {item.shipperConfirmed ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] px-1 py-0">
                                  Almacén OK
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[9px] px-1 py-0">
                                  Pendiente
                                </Badge>
                              )}
                            </div>
                            <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]" title={item.trackingNumber}>
                              {item.trackingNumber || 'Sin tracking'}
                            </p>
                            {item.shipperTracking && item.shipperTracking !== item.trackingNumber && (
                              <p className="font-mono text-[9px] text-blue-700 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40 px-1 py-0.5 rounded border border-blue-200 truncate max-w-[140px]" title={`Tracking de almacén Shiper: ${item.shipperTracking}`}>
                                🔄 {item.shipperTracking}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Valor USD */}
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.valorUsd}
                            onChange={(e) => updateItemField(idx, 'valorUsd', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs font-bold text-right w-20 ml-auto"
                          />
                        </TableCell>

                        {/* Titular RUC */}
                        <TableCell>
                          <Select
                            value={item.importerProfile}
                            onValueChange={(val: 'fabio' | 'peggy') => updateItemProfile(idx, val)}
                          >
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fabio">Fabio (10762026835)</SelectItem>
                              <SelectItem value="peggy">Peggy (10091870911)</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>

                        {/* Quitar */}
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(idx)}
                            className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            title="Quitar de esta declaración"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              <strong>{items.length}</strong> compras seleccionadas
            </span>
            <span>•</span>
            <span>
              <strong>{totals.totalUnits}</strong> unidades totales
            </span>
            <span>•</span>
            <span className="font-bold text-foreground">
              Total FOB: ${totals.totalFob.toFixed(2)} USD
            </span>
            {totals.fabioFob > 0 && (
              <span className="hidden md:inline">
                (Fabio: ${totals.fabioFob.toFixed(2)})
              </span>
            )}
            {totals.peggyFob > 0 && (
              <span className="hidden md:inline">
                (Peggy: ${totals.peggyFob.toFixed(2)})
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>

            {/* Auto-archivar Checkbox Toggle */}
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100/60 transition-colors mr-1">
              <input
                type="checkbox"
                checked={autoArchiveOnDownload}
                onChange={(e) => setAutoArchiveOnDownload(e.target.checked)}
                className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
              />
              <span className="font-semibold text-[11px] text-emerald-900 dark:text-emerald-200">
                Auto-archivar al descargar
              </span>
            </label>

            {/* Marcar como Ya Embarcados (Archivar) */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleArchiveItems}
              disabled={archiving || items.length === 0}
              className="gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 font-semibold text-xs"
              title="Mover estos productos a la sección de Archivados para que no se vuelvan a embarcar"
            >
              {archiving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Archive className="h-3.5 w-3.5 text-slate-600" />
              )}
              Marcar Ya Embarcados
            </Button>

            {/* Copiar Texto para Correo de Embarque Shiper */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyEmailDraft}
              disabled={items.length === 0}
              className="gap-1.5 border-blue-300 text-blue-800 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 font-semibold text-xs"
              title="Copiar texto formal para el correo a Shiper con la lista de trackings actualizados en almacén"
            >
              <Mail className="h-3.5 w-3.5 text-blue-600" />
              Copiar Correo Shiper
            </Button>

            {/* Descargar Orden de Embarque */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadEmbarque}
              disabled={downloadingEmbarque || items.length === 0}
              className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 font-semibold text-xs"
            >
              {downloadingEmbarque ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 text-emerald-600" />
              )}
              Hoja de Embarque (.xlsx)
            </Button>

            {/* Descargar Traducción Factura */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTraduccion}
              disabled={downloadingTraduccion || items.length === 0}
              className="gap-1.5 border-purple-300 text-purple-800 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 font-semibold text-xs"
            >
              {downloadingTraduccion ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 text-purple-600" />
              )}
              Traducción SUNAT (.xlsx)
            </Button>

            {/* Descargar Ambos */}
            <Button
              size="sm"
              onClick={handleDownloadBoth}
              disabled={downloadingEmbarque || downloadingTraduccion || items.length === 0}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar Ambos (.xlsx)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
