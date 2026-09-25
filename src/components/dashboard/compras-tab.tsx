'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  ExternalLink,
  Search,
  RefreshCw,
  Plus,
  Save,
  Check,
  Copy,
  Truck,
  CheckCircle2,
  Clock,
  Archive,
  ArrowUpDown,
  Filter,
  Layers,
  ChevronRight,
  Maximize2,
  Package,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Building2,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface ComprasTabProps {
  onNavigate?: (tab: string) => void;
  isStandalone?: boolean;
}

export function ComprasTab({ onNavigate, isStandalone = false }: ComprasTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [activeSheet, setActiveSheet] = useState<string>('SEPTIEMBRE');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetsData, setSheetsData] = useState<Record<string, any[]>>({});
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Editing state for cells
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/compras/excel');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar compras');

      setSheetNames(data.sheetNames || []);
      setSheetsData(data.sheetsData || {});
      setDbProducts(data.dbProducts || []);

      if (data.sheetNames?.includes('SEPTIEMBRE')) {
        setActiveSheet('SEPTIEMBRE');
      } else if (data.sheetNames?.length > 0) {
        setActiveSheet(data.sheetNames[0]);
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error de carga',
        description: err.message || 'No se pudo leer la hoja contable de compras',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string, id: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copiado', description: `${label} copiado al portapapeles` });
  };

  // 1. Download official Excel file
  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      const res = await fetch('/api/compras/excel', { method: 'POST' });
      if (!res.ok) throw new Error('Error al descargar el archivo Excel');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `COMPRAS_EBAY_CONTABILIDAD_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: '📥 Excel Descargado',
        description: 'Se descargó el libro completo de compras con todas las pestañas y fórmulas.',
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error de descarga',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  // 2. Inline Edit & Save to DB
  const handleStartEdit = (item: any) => {
    const key = item.id || item.orderNumber;
    setEditingRow(key);
    setEditValues({
      salePricePen: item.salePricePen || item.precioVentaPen || '',
      advertisingCostUsd: item.advertisingCostUsd || item.publicidadUsd || '',
      extraCostsUsd: item.extraCostsUsd || item.costosExtraUsd || '',
      suggestedPricePen: item.suggestedPricePen || item.precioSugeridoPen || '',
      stock: item.stock || item.quantity || 1,
    });
  };

  const handleSaveEdit = async (item: any) => {
    const productId = item.id || dbProducts.find((p) => p.orderNumber === item.orderNumber)?.id;
    if (!productId) {
      toast({
        title: 'Solo lectura',
        description: 'Este registro pertenece al historial del archivo Excel estático.',
      });
      setEditingRow(null);
      return;
    }

    try {
      setSavingId(productId);
      const payload = {
        salePricePEN: parseFloat(editValues.salePricePen) || 0,
        advertisingCostUSD: parseFloat(editValues.advertisingCostUsd) || 0,
        extraCostsUSD: parseFloat(editValues.extraCostsUsd) || 0,
        suggestedPricePEN: parseFloat(editValues.suggestedPricePen) || 0,
        quantity: parseInt(editValues.stock, 10) || 1,
      };

      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error al guardar cambios');

      toast({
        title: '💾 Cambios Guardados',
        description: `Se actualizó el producto ${item.orderNumber} en la base de datos en tiempo real.`,
      });
      setEditingRow(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error al guardar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  // 3. Quick Toggle Shipper Confirmed
  const handleToggleShipperConfirmed = async (item: any) => {
    const productId = item.id || dbProducts.find((p) => p.orderNumber === item.orderNumber)?.id;
    if (!productId) return;

    const currentConfirmed = Boolean(item.shipperConfirmed);
    const newStatus = !currentConfirmed;

    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipperConfirmed: newStatus }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      toast({
        title: newStatus ? '✅ Almacén Shiper OK' : '⏳ Pendiente Shiper',
        description: `Producto ${item.orderNumber} actualizado.`,
      });
      await loadData();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Active Rows Calculation
  const currentRows = useMemo(() => {
    let rows: any[] = [];

    if (activeSheet === 'TODOS_EN_BD') {
      rows = dbProducts.map((p, idx) => ({
        rowNumber: idx + 1,
        id: p.id,
        fechaCompra: new Date(p.purchaseDate).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        sistema: 'SI',
        embarcado: p.isArchived ? 'SI' : p.shipperConfirmed ? 'LISTO' : 'NO',
        orderNumber: p.orderNumber,
        courier: p.courier || 'USPS',
        trackingNumber: p.shipperTracking || p.trackingNumber || '',
        proveedor: p.supplier || 'eBay',
        proveedorUrl: `https://www.ebay.com/usr/${p.supplier || 'eBay'}`,
        descripcion: p.description,
        itemUrl: p.orderNumber ? `https://order.ebay.com/ord/show?orderId=${p.orderNumber}` : undefined,
        precioCompraUsd: p.orderTotalUsd,
        precioCompraPen: p.purchasePricePen,
        precioVentaPen: p.salePricePen || 0,
        publicidadUsd: p.advertisingCostUsd || 0,
        costosExtraUsd: p.extraCostsUsd || 0,
        gananciaPen: p.profitPen || 0,
        stock: p.quantity || 1,
        precioSugeridoPen: p.suggestedPricePen || 0,
        shipperConfirmed: p.shipperConfirmed,
        isDbProduct: true,
      }));
    } else {
      const sheetRows = sheetsData[activeSheet] || [];
      rows = sheetRows.map((r) => {
        const matchingDb = dbProducts.find((p) => p.orderNumber && p.orderNumber === r.orderNumber);
        return {
          ...r,
          id: matchingDb?.id,
          shipperConfirmed: matchingDb?.shipperConfirmed,
          isDbProduct: Boolean(matchingDb),
        };
      });
    }

    if (!search.trim()) return rows;

    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        (r.descripcion || '').toLowerCase().includes(q) ||
        (r.orderNumber || '').toLowerCase().includes(q) ||
        (r.trackingNumber || '').toLowerCase().includes(q) ||
        (r.proveedor || '').toLowerCase().includes(q)
    );
  }, [activeSheet, sheetsData, dbProducts, search]);

  // Totals of Current View
  const metrics = useMemo(() => {
    const totalItems = currentRows.length;
    const totalUsd = currentRows.reduce((acc, r) => acc + (Number(r.precioCompraUsd) || 0), 0);
    const totalPen = currentRows.reduce((acc, r) => acc + (Number(r.precioCompraPen) || 0), 0);
    const totalVentaPen = currentRows.reduce((acc, r) => acc + (Number(r.precioVentaPen) || 0), 0);
    const totalGananciaPen = currentRows.reduce((acc, r) => acc + (Number(r.gananciaPen) || 0), 0);
    const totalUnits = currentRows.reduce((acc, r) => acc + (Number(r.stock) || 1), 0);
    const embarcadosCount = currentRows.filter((r) => r.embarcado === 'SI').length;
    const listosCount = currentRows.filter((r) => r.embarcado === 'LISTO' || r.shipperConfirmed).length;

    return {
      totalItems,
      totalUnits,
      totalUsd,
      totalPen,
      totalVentaPen,
      totalGananciaPen,
      embarcadosCount,
      listosCount,
    };
  }, [currentRows]);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shadow-xs">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Registro de Compras & Logística Contable
              </h2>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold">
                Excel en Tiempo Real
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Plantilla oficial sincronizada con eBay, casillero Shiper y base de datos PostgreSQL.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {!isStandalone && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/dashboard/compras', '_blank')}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Abrir en pantalla completa o nueva ventana"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Nueva Ventana
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 text-xs"
            title="Recargar datos"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadExcel}
            disabled={downloading}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar Excel Completo (.xlsx)
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        <Card className="p-3 bg-card border">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            <span>Compras / Paquetes</span>
            <Package className="h-3.5 w-3.5 text-muted-foreground/70" />
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-lg font-bold text-foreground">{metrics.totalItems}</span>
            <span className="text-xs text-muted-foreground">({metrics.totalUnits} unids)</span>
          </div>
        </Card>

        <Card className="p-3 bg-card border">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            <span>Inversión Total USD</span>
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
          </p>
          <div className="mt-1">
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              ${metrics.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        <Card className="p-3 bg-card border">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            <span>Inversión Total PEN</span>
            <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
          </p>
          <div className="mt-1">
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              S/ {metrics.totalPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        <Card className="p-3 bg-card border">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            <span>Ventas Proyectadas</span>
            <ShoppingBag className="h-3.5 w-3.5 text-purple-600" />
          </p>
          <div className="mt-1">
            <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
              S/ {metrics.totalVentaPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        <Card className="p-3 bg-card border col-span-2 sm:col-span-1">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            <span>Estado Shiper</span>
            <Building2 className="h-3.5 w-3.5 text-emerald-600" />
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-300">
              ✓ {metrics.listosCount} Listos
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300">
              📦 {metrics.embarcadosCount} Embarc.
            </span>
          </div>
        </Card>
      </div>

      {/* Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2">
        {/* Month Sheet Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <Button
            variant={activeSheet === 'TODOS_EN_BD' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSheet('TODOS_EN_BD')}
            className={`h-8 text-xs font-semibold shrink-0 gap-1.5 ${
              activeSheet === 'TODOS_EN_BD' ? 'bg-emerald-600 text-white' : ''
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Todas en BD ({dbProducts.length})
          </Button>

          {sheetNames.map((sheet) => (
            <Button
              key={sheet}
              variant={activeSheet === sheet ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSheet(sheet)}
              className={`h-8 text-xs font-medium shrink-0 ${
                activeSheet === sheet ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold' : ''
              }`}
            >
              {sheet}
              {sheetsData[sheet]?.length > 0 && (
                <span className="ml-1 text-[10px] opacity-70">({sheetsData[sheet].length})</span>
              )}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por orden, tracking, título..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Interactive Spreadsheet Table */}
      <div className="rounded-lg border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[70vh]">
          <Table className="text-xs">
            <TableHeader className="bg-muted/70 sticky top-0 z-10 text-[11px]">
              <TableRow>
                <TableHead className="w-[40px] text-center font-bold">#</TableHead>
                <TableHead className="w-[140px]">Fecha Compra</TableHead>
                <TableHead className="w-[70px] text-center">Sistema</TableHead>
                <TableHead className="w-[90px] text-center">Embarcado</TableHead>
                <TableHead className="w-[130px]">N° Orden</TableHead>
                <TableHead className="w-[75px] text-center">Courier</TableHead>
                <TableHead className="w-[160px]">Tracking</TableHead>
                <TableHead className="w-[110px]">Proveedor</TableHead>
                <TableHead className="min-w-[260px]">Descripción</TableHead>
                <TableHead className="w-[100px] text-right font-bold text-foreground">Compra $</TableHead>
                <TableHead className="w-[100px] text-right font-bold text-foreground">Compra S/</TableHead>
                <TableHead className="w-[95px] text-right text-purple-700 dark:text-purple-300 font-bold">Venta S/</TableHead>
                <TableHead className="w-[85px] text-right text-muted-foreground">Pub. $</TableHead>
                <TableHead className="w-[85px] text-right text-muted-foreground">Extra $</TableHead>
                <TableHead className="w-[95px] text-right text-emerald-700 dark:text-emerald-400 font-bold">Ganancia S/</TableHead>
                <TableHead className="w-[60px] text-center">Stock</TableHead>
                <TableHead className="w-[95px] text-right text-blue-700 dark:text-blue-300 font-medium">Sugerido S/</TableHead>
                <TableHead className="w-[65px] text-center">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={18} className="py-12 text-center text-muted-foreground">
                    <FileSpreadsheet className="h-8 w-8 mx-auto opacity-40 mb-2" />
                    <p className="font-medium">No hay compras registradas en esta hoja.</p>
                  </TableCell>
                </TableRow>
              ) : (
                currentRows.map((r, idx) => {
                  const key = r.id || r.orderNumber || idx;
                  const isEditing = editingRow === key;

                  return (
                    <TableRow key={key} className="hover:bg-muted/40 transition-colors">
                      {/* # */}
                      <TableCell className="text-center font-mono text-muted-foreground font-semibold">
                        {idx + 1}
                      </TableCell>

                      {/* Fecha Compra */}
                      <TableCell className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                        {r.fechaCompra}
                      </TableCell>

                      {/* Sistema */}
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] px-1 py-0">
                          SI
                        </Badge>
                      </TableCell>

                      {/* Embarcado */}
                      <TableCell className="text-center">
                        {r.embarcado === 'SI' ? (
                          <Badge className="bg-slate-700 text-white text-[10px] px-1.5 py-0">
                            ✓ Embarcado
                          </Badge>
                        ) : r.shipperConfirmed || r.embarcado === 'LISTO' ? (
                          <button
                            onClick={() => handleToggleShipperConfirmed(r)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-bold bg-emerald-100 hover:bg-amber-100 text-emerald-800 border border-emerald-300 cursor-pointer"
                            title="Listo en Miami. Clic para cambiar."
                          >
                            <Check className="h-2.5 w-2.5 text-emerald-600" />
                            Listo
                          </button>
                        ) : (
                          <button
                            onClick={() => handleToggleShipperConfirmed(r)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-medium bg-amber-50 hover:bg-emerald-50 text-amber-800 border border-amber-300 cursor-pointer"
                            title="Pendiente en Shiper. Clic para marcar Listo."
                          >
                            ⏳ Pendiente
                          </button>
                        )}
                      </TableCell>

                      {/* N° Orden */}
                      <TableCell>
                        <div className="flex items-center gap-1 font-mono text-xs">
                          <span className="font-semibold text-foreground">{r.orderNumber}</span>
                          {r.itemUrl && (
                            <a
                              href={r.itemUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-600 hover:text-orange-700"
                              title="Ver orden en eBay"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                          <button
                            onClick={() => handleCopy(r.orderNumber, `ord-${key}`, 'N° Orden')}
                            className="p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            {copiedId === `ord-${key}` ? (
                              <Check className="h-2.5 w-2.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-2.5 w-2.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>

                      {/* Courier */}
                      <TableCell className="text-center font-semibold text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-muted text-foreground border">
                          {r.courier}
                        </span>
                      </TableCell>

                      {/* Tracking */}
                      <TableCell>
                        <div className="flex items-center gap-1 font-mono text-[11px] truncate max-w-[155px]">
                          <span title={r.trackingNumber}>{r.trackingNumber || '-'}</span>
                          {r.trackingNumber && (
                            <button
                              onClick={() => handleCopy(r.trackingNumber, `tr-${key}`, 'Tracking')}
                              className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                            >
                              {copiedId === `tr-${key}` ? (
                                <Check className="h-2.5 w-2.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-2.5 w-2.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>

                      {/* Proveedor */}
                      <TableCell>
                        {r.proveedorUrl ? (
                          <a
                            href={r.proveedorUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate max-w-[100px] block"
                            title={r.proveedor}
                          >
                            {r.proveedor}
                          </a>
                        ) : (
                          <span className="truncate max-w-[100px] block">{r.proveedor}</span>
                        )}
                      </TableCell>

                      {/* Descripción */}
                      <TableCell>
                        <p className="line-clamp-2 text-[11px] leading-tight" title={r.descripcion}>
                          {r.descripcion}
                        </p>
                      </TableCell>

                      {/* Compra $ */}
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        ${Number(r.precioCompraUsd || 0).toFixed(2)}
                      </TableCell>

                      {/* Compra S/ */}
                      <TableCell className="text-right font-mono font-medium text-muted-foreground">
                        S/ {Number(r.precioCompraPen || 0).toFixed(2)}
                      </TableCell>

                      {/* Venta S/ - EDITABLE */}
                      <TableCell className="text-right font-mono">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.salePricePen}
                            onChange={(e) => setEditValues({ ...editValues, salePricePen: e.target.value })}
                            className="h-6 w-20 text-right p-1 text-xs font-mono font-bold"
                          />
                        ) : (
                          <span
                            onClick={() => handleStartEdit(r)}
                            className="cursor-pointer hover:bg-muted px-1 py-0.5 rounded font-bold text-purple-700 dark:text-purple-300"
                            title="Clic para editar precio de venta"
                          >
                            {r.precioVentaPen ? `S/ ${Number(r.precioVentaPen).toFixed(2)}` : '-'}
                          </span>
                        )}
                      </TableCell>

                      {/* Publicidad $ - EDITABLE */}
                      <TableCell className="text-right font-mono">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.advertisingCostUsd}
                            onChange={(e) => setEditValues({ ...editValues, advertisingCostUsd: e.target.value })}
                            className="h-6 w-16 text-right p-1 text-xs font-mono"
                          />
                        ) : (
                          <span
                            onClick={() => handleStartEdit(r)}
                            className="cursor-pointer hover:bg-muted px-1 py-0.5 rounded text-muted-foreground"
                            title="Clic para editar costo de publicidad"
                          >
                            {r.publicidadUsd ? `$${Number(r.publicidadUsd).toFixed(2)}` : '-'}
                          </span>
                        )}
                      </TableCell>

                      {/* Costos Extra $ - EDITABLE */}
                      <TableCell className="text-right font-mono">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.extraCostsUsd}
                            onChange={(e) => setEditValues({ ...editValues, extraCostsUsd: e.target.value })}
                            className="h-6 w-16 text-right p-1 text-xs font-mono"
                          />
                        ) : (
                          <span
                            onClick={() => handleStartEdit(r)}
                            className="cursor-pointer hover:bg-muted px-1 py-0.5 rounded text-muted-foreground"
                            title="Clic para editar costos extra"
                          >
                            {r.costosExtraUsd ? `$${Number(r.costosExtraUsd).toFixed(2)}` : '-'}
                          </span>
                        )}
                      </TableCell>

                      {/* Ganancia S/ */}
                      <TableCell className="text-right font-mono font-bold">
                        {r.gananciaPen ? (
                          <span className={r.gananciaPen >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            S/ {Number(r.gananciaPen).toFixed(2)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>

                      {/* Stock - EDITABLE */}
                      <TableCell className="text-center font-mono">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="1"
                            value={editValues.stock}
                            onChange={(e) => setEditValues({ ...editValues, stock: e.target.value })}
                            className="h-6 w-12 text-center p-1 text-xs font-mono"
                          />
                        ) : (
                          <span
                            onClick={() => handleStartEdit(r)}
                            className="cursor-pointer hover:bg-muted px-1.5 py-0.5 rounded font-bold"
                          >
                            {r.stock || 1}
                          </span>
                        )}
                      </TableCell>

                      {/* Sugerido S/ - EDITABLE */}
                      <TableCell className="text-right font-mono text-blue-600 dark:text-blue-400">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editValues.suggestedPricePen}
                            onChange={(e) => setEditValues({ ...editValues, suggestedPricePen: e.target.value })}
                            className="h-6 w-20 text-right p-1 text-xs font-mono"
                          />
                        ) : (
                          <span
                            onClick={() => handleStartEdit(r)}
                            className="cursor-pointer hover:bg-muted px-1 py-0.5 rounded"
                            title="Clic para editar precio sugerido"
                          >
                            {r.precioSugeridoPen ? `S/ ${Number(r.precioSugeridoPen).toFixed(2)}` : '-'}
                          </span>
                        )}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleSaveEdit(r)}
                            disabled={savingId === (r.id || r.orderNumber)}
                            className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Guardar cambios"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleStartEdit(r)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Editar valores de esta fila"
                          >
                            <span className="text-[10px]">✏️</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
