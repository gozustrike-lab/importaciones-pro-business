'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  ExternalLink,
  Search,
  RefreshCw,
  Check,
  Copy,
  Truck,
  Maximize2,
  Package,
  TrendingUp,
  DollarSign,
  Building2,
  ShoppingBag,
  Calendar,
  Layers,
  Loader2,
  ShieldCheck,
  CheckCheck,
  User,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { sanitizeSunatModel } from '@/lib/shipper-classification';
import { syncPurchasesToExcel } from '@/lib/api';

interface ComprasTabProps {
  onNavigate?: (tab: string) => void;
  isStandalone?: boolean;
}

export interface PurchaseItem {
  id: string;
  year: string;
  monthIndex: number;
  monthName: string;
  fechaCompraFormatted: string;
  purchaseDate: string;
  orderNumber: string;
  courier: string;
  trackingNumber: string;
  originalTracking: string;
  shipperTracking: string;
  shipperConfirmed: boolean;
  supplier: string;
  supplierUrl: string;
  description: string;
  model: string;
  category: string;
  quantity: number;
  purchasePriceUsd: number;
  shippingCostUsd: number;
  orderTotalUsd: number;
  purchasePricePen: number;
  salePricePen: number;
  suggestedPricePen: number;
  advertisingCostUsd: number;
  extraCostsUsd: number;
  profitPen: number;
  exchangeRate: number;
  shippingStatus: string;
  isArchived: boolean;
  importerProfile: string;
  recipientName?: string;
  orderUrl?: string;
  itemUrl?: string;
  imageUrl?: string;
}

export function isPeggyItem(item: { importerProfile?: string; recipientName?: string }): boolean {
  const imp = (item.importerProfile || '').toLowerCase();
  const rec = (item.recipientName || '').toLowerCase();
  return (
    imp === 'peggy' ||
    imp === 'liliana' ||
    rec.includes('peggy') ||
    rec.includes('liliana') ||
    rec.includes('orduna') ||
    rec.includes('orduña')
  );
}

const MONTH_ORDER = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

function getCourierTrackingUrl(courier: string, tracking: string): string {
  if (!tracking) return '#';
  const c = (courier || '').toUpperCase();
  const t = tracking.trim();
  if (c.includes('UPS') || t.startsWith('1Z')) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}`;
  }
  if (c.includes('FEDEX') || (t.length >= 12 && t.length <= 15 && /^\d+$/.test(t))) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}`;
  }
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(t)}`;
}

export function ComprasTab({ onNavigate, isStandalone = false }: ComprasTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [products, setProducts] = useState<PurchaseItem[]>([]);
  const [years, setYears] = useState<string[]>(['2026', '2025']);
  const [monthsStructure, setMonthsStructure] = useState<Record<string, string[]>>({});

  // View Mode: Smart Interactive Table with eBay Photos vs Embedded Real Excel (.xlsx)
  const [viewMode, setViewMode] = useState<'smart' | 'excel'>('smart');
  const [excelOwner, setExcelOwner] = useState<'fabio' | 'liliana'>('fabio');
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [activeExcelSheet, setActiveExcelSheet] = useState<string>('');
  const [excelRows, setExcelRows] = useState<any[][]>([]);
  const [excelFileName, setExcelFileName] = useState<string>('Compras Ebay FABIO.xlsx');
  const [loadingExcel, setLoadingExcel] = useState(false);

  // Navigation Filter State: Owner (Fabio vs Peggy vs All), Year, Month, Search
  const [selectedOwner, setSelectedOwner] = useState<'all' | 'fabio' | 'peggy'>('fabio');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<string>('SEPTIEMBRE');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Auto-Save State
  const [editBuffer, setEditBuffer] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);
  const [syncingExcel, setSyncingExcel] = useState(false);

  const [selectedExcelYear, setSelectedExcelYear] = useState<'2026' | '2025'>('2026');

  const loadWorkbook = async (
    owner: 'fabio' | 'liliana',
    sheet = '',
    year: '2026' | '2025' = selectedExcelYear
  ) => {
    try {
      setLoadingExcel(true);
      const q = new URLSearchParams({ mode: 'workbook', owner, year });
      if (sheet) q.set('sheet', sheet);
      const res = await fetch(`/api/compras/excel?${q.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al leer archivo Excel');
      setExcelSheets(data.sheets || []);
      setActiveExcelSheet(data.activeSheet || '');
      setExcelRows(data.rows || []);
      setExcelFileName(data.fileName || `Compras Ebay ${owner.toUpperCase()}${year === '2025' ? ' 2025' : ''}.xlsx`);
    } catch (err: any) {
      toast({
        title: 'Error leyendo Excel',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingExcel(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/compras/excel');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar compras');

      const prods: PurchaseItem[] = data.products || [];
      setProducts(prods);
      setYears(data.years || ['2026', '2025']);
      setMonthsStructure(data.monthsStructure || {});

      const yearMonths = data.monthsStructure?.[selectedYear] || [];
      if (!yearMonths.includes(selectedMonth) && yearMonths.length > 0) {
        setSelectedMonth(yearMonths[0]);
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error de carga',
        description: err.message || 'No se pudo leer las compras de la base de datos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncExcel = async () => {
    try {
      setSyncingExcel(true);
      const res = await syncPurchasesToExcel();
      toast({
        title: 'Sincronización con Excels completada',
        description: res.message || 'Todas las compras fueron actualizadas en los Excels de Fabio y Liliana.',
      });
      await loadData();
    } catch (err: any) {
      toast({
        title: 'Error de sincronización',
        description: err?.message || 'No se pudo sincronizar con los Excels de Google Drive',
        variant: 'destructive',
      });
    } finally {
      setSyncingExcel(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopy = (text: string, id: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Copiado', description: `${label} copiado al portapapeles.` });
  };

  // 1. Download official Excel file
  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      const ownerParam = selectedOwner === 'peggy' ? 'liliana' : 'fabio';
      const yearParam = selectedYear === '2025' ? '2025' : '2026';
      const res = await fetch(`/api/compras/excel?owner=${ownerParam}&year=${yearParam}`, { method: 'POST' });
      if (!res.ok) throw new Error('Error al descargar el archivo Excel');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      const label = selectedOwner === 'peggy' ? 'LILIANA' : (selectedOwner === 'fabio' ? 'FABIO' : 'CONSOLIDADO');
      a.download = `COMPRAS_EBAY_${label}_${yearParam}_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: '📥 Excel Descargado',
        description: `Se descargó el libro de compras de ${label} (${yearParam}) con todas las pestañas y fórmulas.`,
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

  // 2. Real-Time Auto-Save on Blur / Enter
  const handleAutoSave = async (
    productId: string,
    field: 'model' | 'salePricePen' | 'advertisingCostUsd' | 'extraCostsUsd' | 'suggestedPricePen' | 'quantity',
    rawNewValue: string,
    currentValue: any
  ) => {
    const key = `${productId}_${field}`;
    const cleanStr = (rawNewValue ?? '').trim();
    const cleanCurrent = (currentValue ?? '').toString().trim();

    // No changes? Skip network call
    if (cleanStr === cleanCurrent) return;

    // Prepare payload & optimistic update
    let payload: Record<string, any> = {};
    let updatedVal: any = cleanStr;

    if (field === 'model') {
      const sanitized = sanitizeSunatModel(cleanStr);
      payload.model = sanitized;
      updatedVal = sanitized;
    } else if (field === 'salePricePen') {
      const num = parseFloat(cleanStr) || 0;
      payload.salePricePEN = num;
      updatedVal = num;
    } else if (field === 'advertisingCostUsd') {
      const num = parseFloat(cleanStr) || 0;
      payload.advertisingCostUSD = num;
      updatedVal = num;
    } else if (field === 'extraCostsUsd') {
      const num = parseFloat(cleanStr) || 0;
      payload.extraCostsUSD = num;
      updatedVal = num;
    } else if (field === 'suggestedPricePen') {
      const num = parseFloat(cleanStr) || 0;
      payload.suggestedPricePEN = num;
      updatedVal = num;
    } else if (field === 'quantity') {
      const num = parseInt(cleanStr, 10) || 1;
      payload.quantity = num;
      updatedVal = num;
    }

    try {
      setSaveStatus((prev) => ({ ...prev, [key]: 'saving' }));

      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Error al guardar');
      }

      // Optimistically update product in local state
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== productId) return p;
          const updated = { ...p, [field]: updatedVal };
          // Recalculate profit if financial fields changed
          const sale = Number(field === 'salePricePen' ? updatedVal : updated.salePricePen) || 0;
          const adv = Number(field === 'advertisingCostUsd' ? updatedVal : updated.advertisingCostUsd) || 0;
          const extra = Number(field === 'extraCostsUsd' ? updatedVal : updated.extraCostsUsd) || 0;
          const buyPen = Number(updated.purchasePricePen) || 0;
          const tc = Number(updated.exchangeRate) || 3.40;
          updated.profitPen = sale > 0 ? sale - buyPen - (adv + extra) * tc : 0;
          return updated;
        })
      );

      // Clear edit buffer for this field
      setEditBuffer((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });

      setSaveStatus((prev) => ({ ...prev, [key]: 'saved' }));
      const fieldLabels: Record<string, string> = {
        model: 'Modelo SUNAT',
        salePricePen: 'Precio de Venta',
        advertisingCostUsd: 'Costo Publicidad',
        extraCostsUsd: 'Costos Extra',
        suggestedPricePen: 'Precio Sugerido',
        quantity: 'Stock',
      };
      setLastSavedMessage(`✓ Guardado: ${fieldLabels[field]} actualizado`);

      setTimeout(() => {
        setSaveStatus((prev) => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
        });
      }, 2500);
    } catch (err: any) {
      console.error('AutoSave Error:', err);
      setSaveStatus((prev) => ({ ...prev, [key]: 'error' }));
      toast({
        title: 'Error de autoguardado',
        description: err.message || 'No se pudo guardar el cambio',
        variant: 'destructive',
      });
    }
  };

  // 3. Quick Toggle Shipper Confirmed
  const handleToggleShipperConfirmed = async (item: PurchaseItem) => {
    const newStatus = !item.shipperConfirmed;
    try {
      // Optimistic update
      setProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, shipperConfirmed: newStatus } : p))
      );

      const res = await fetch(`/api/products/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipperConfirmed: newStatus }),
      });

      if (!res.ok) throw new Error('Error al actualizar en BD');

      toast({
        title: newStatus ? '✅ Almacén Shiper OK' : '⏳ Pendiente Shiper',
        description: `Producto ${item.orderNumber} actualizado en tiempo real.`,
      });
    } catch (err: any) {
      // Rollback
      setProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, shipperConfirmed: !newStatus } : p))
      );
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // 3.1 Toggle Archived / Reactivate
  const handleToggleArchived = async (item: PurchaseItem) => {
    const newArchived = !item.isArchived;
    try {
      setProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, isArchived: newArchived } : p))
      );

      const res = await fetch(`/api/products/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: newArchived }),
      });

      if (!res.ok) throw new Error('Error al actualizar estado');

      toast({
        title: newArchived ? '📦 Marcado como Embarcado' : '🔄 Reactivado en Miami (Listo para Embarcar)',
        description: `Producto ${item.orderNumber} ${newArchived ? 'marcado como embarcado a Perú' : 'reactivado en almacén de Miami'}.`,
      });
    } catch (err: any) {
      setProducts((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, isArchived: !newArchived } : p))
      );
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Owner counts (for currently selected year, and overall)
  const ownerCountsForYear = useMemo(() => {
    const yearProds = selectedYear === 'ALL' ? products : products.filter((p) => p.year === selectedYear);
    let fabioCount = 0;
    let peggyCount = 0;
    yearProds.forEach((p) => {
      if (isPeggyItem(p)) {
        peggyCount++;
      } else {
        fabioCount++;
      }
    });
    return {
      all: yearProds.length,
      fabio: fabioCount,
      peggy: peggyCount,
    };
  }, [products, selectedYear]);

  const ownerCountsTotal = useMemo(() => {
    let fabioCount = 0;
    let peggyCount = 0;
    products.forEach((p) => {
      if (isPeggyItem(p)) {
        peggyCount++;
      } else {
        fabioCount++;
      }
    });
    return {
      all: products.length,
      fabio: fabioCount,
      peggy: peggyCount,
    };
  }, [products]);

  // 4. Available Months for Selected Year & Selected Owner
  const availableMonths = useMemo(() => {
    let list = products;
    if (selectedOwner === 'fabio') {
      list = list.filter((p) => !isPeggyItem(p));
    } else if (selectedOwner === 'peggy') {
      list = list.filter((p) => isPeggyItem(p));
    }

    if (selectedYear !== 'ALL') {
      list = list.filter((p) => p.year === selectedYear);
    }

    const set = new Set<string>();
    list.forEach((p) => set.add(p.monthName));
    return Array.from(set).sort((a, b) => MONTH_ORDER.indexOf(b) - MONTH_ORDER.indexOf(a));
  }, [products, selectedOwner, selectedYear]);

  // Automatically adjust month if current month is not in available months
  useEffect(() => {
    if (selectedMonth !== 'ALL' && availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
      if (selectedYear === '2026' && availableMonths.includes('SEPTIEMBRE')) {
        setSelectedMonth('SEPTIEMBRE');
      } else {
        setSelectedMonth(availableMonths[0]);
      }
    }
  }, [availableMonths, selectedMonth, selectedYear]);

  // 5. Filtered Rows Calculation
  const filteredRows = useMemo(() => {
    let list = products;

    // Filter by Owner (Fabio vs Peggy vs All)
    if (selectedOwner === 'fabio') {
      list = list.filter((p) => !isPeggyItem(p));
    } else if (selectedOwner === 'peggy') {
      list = list.filter((p) => isPeggyItem(p));
    }

    // Filter by year
    if (selectedYear !== 'ALL') {
      list = list.filter((p) => p.year === selectedYear);
    }

    // Filter by month
    if (selectedMonth !== 'ALL') {
      list = list.filter((p) => p.monthName === selectedMonth);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.description || '').toLowerCase().includes(q) ||
          (p.orderNumber || '').toLowerCase().includes(q) ||
          (p.trackingNumber || '').toLowerCase().includes(q) ||
          (p.supplier || '').toLowerCase().includes(q) ||
          (p.model || '').toLowerCase().includes(q) ||
          (p.courier || '').toLowerCase().includes(q) ||
          (p.importerProfile || '').toLowerCase().includes(q) ||
          (p.recipientName || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [products, selectedOwner, selectedYear, selectedMonth, search]);

  // 6. Metrics Summary
  const metrics = useMemo(() => {
    const totalItems = filteredRows.length;
    const totalUnits = filteredRows.reduce((acc, r) => acc + (Number(r.quantity) || 1), 0);
    const totalUsd = filteredRows.reduce((acc, r) => acc + (Number(r.orderTotalUsd) || 0), 0);
    const totalPen = filteredRows.reduce((acc, r) => acc + (Number(r.purchasePricePen) || 0), 0);
    const totalVentaPen = filteredRows.reduce((acc, r) => acc + (Number(r.salePricePen) || 0), 0);
    const totalGananciaPen = filteredRows.reduce((acc, r) => acc + (Number(r.profitPen) || 0), 0);
    const listosCount = filteredRows.filter((r) => r.shipperConfirmed).length;
    const embarcadosCount = filteredRows.filter((r) => r.isArchived).length;
    const pendientesCount = totalItems - listosCount - embarcadosCount;

    return {
      totalItems,
      totalUnits,
      totalUsd,
      totalPen,
      totalVentaPen,
      totalGananciaPen,
      listosCount,
      embarcadosCount,
      pendientesCount: Math.max(0, pendientesCount),
    };
  }, [filteredRows]);

  // Year counts filtered by selected owner
  const yearCounts = useMemo(() => {
    let list = products;
    if (selectedOwner === 'fabio') {
      list = list.filter((p) => !isPeggyItem(p));
    } else if (selectedOwner === 'peggy') {
      list = list.filter((p) => isPeggyItem(p));
    }

    const counts: Record<string, number> = { ALL: list.length };
    years.forEach((y) => {
      counts[y] = list.filter((p) => p.year === y).length;
    });
    return counts;
  }, [products, years, selectedOwner]);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shadow-xs">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Registro de Compras & Logística Contable
              </h2>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                PostgreSQL en Tiempo Real
              </Badge>
              {lastSavedMessage && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 animate-fade-in">
                  {lastSavedMessage}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Historial completo 2026 y 2025 sincronizado con eBay, Shiper y SUNAT con <span className="font-semibold text-foreground">autoguardado en tiempo real</span>.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
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
            title="Recargar compras de la base de datos"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncExcel}
            disabled={syncingExcel || loading}
            className="gap-1.5 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 shadow-xs"
            title="Sincronizar compras de la base de datos hacia los Excels de Fabio y Liliana en Google Drive"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingExcel ? 'animate-spin' : ''}`} />
            {syncingExcel ? 'Sincronizando Excels...' : 'Sincronizar Excels Drive'}
          </Button>

          <Button
            size="sm"
            onClick={handleDownloadExcel}
            disabled={downloading}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            {selectedOwner === 'peggy'
              ? 'Descargar Excel PEGGY (.xlsx)'
              : selectedOwner === 'fabio'
              ? 'Descargar Excel FABIO (.xlsx)'
              : 'Descargar Excel (.xlsx)'}
          </Button>
        </div>
      </div>

      {/* Selector Principal de Titular: FABIO vs PEGGY vs CONSOLIDADO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-xl bg-card border shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mr-1">
            <User className="h-4 w-4 text-primary" />
            <span>Titular de Compras:</span>
          </span>

          {/* Botón FABIO */}
          <Button
            size="sm"
            variant={selectedOwner === 'fabio' ? 'default' : 'outline'}
            onClick={() => {
              setSelectedOwner('fabio');
              if (viewMode === 'excel') {
                setExcelOwner('fabio');
                loadWorkbook('fabio', '', selectedExcelYear);
              }
            }}
            className={`h-9 px-3.5 text-xs font-bold gap-2 transition-all ${
              selectedOwner === 'fabio'
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                : 'hover:bg-blue-50 text-blue-700 dark:text-blue-300 border-blue-200'
            }`}
          >
            <span>👤 Compras FABIO</span>
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${
                selectedOwner === 'fabio' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
              }`}
            >
              {ownerCountsForYear.fabio}
            </Badge>
          </Button>

          {/* Botón PEGGY (LILIANA) */}
          <Button
            size="sm"
            variant={selectedOwner === 'peggy' ? 'default' : 'outline'}
            onClick={() => {
              setSelectedOwner('peggy');
              if (viewMode === 'excel') {
                setExcelOwner('liliana');
                loadWorkbook('liliana', '', selectedExcelYear);
              }
            }}
            className={`h-9 px-3.5 text-xs font-bold gap-2 transition-all ${
              selectedOwner === 'peggy'
                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                : 'hover:bg-purple-50 text-purple-700 dark:text-purple-300 border-purple-200'
            }`}
          >
            <span>👩 Compras PEGGY (Liliana)</span>
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${
                selectedOwner === 'peggy' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
              }`}
            >
              {ownerCountsForYear.peggy}
            </Badge>
          </Button>

          {/* Botón CONSOLIDADO (AMBOS) */}
          <Button
            size="sm"
            variant={selectedOwner === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedOwner('all')}
            className={`h-9 px-3 text-xs font-bold gap-1.5 transition-all ${
              selectedOwner === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>👥 Ambos (Consolidado)</span>
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${
                selectedOwner === 'all'
                  ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                  : 'bg-muted-foreground/10 text-muted-foreground'
              }`}
            >
              {ownerCountsForYear.all}
            </Badge>
          </Button>
        </div>

        {/* Info lateral del titular activo */}
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          {selectedOwner === 'fabio' && (
            <span className="inline-flex items-center gap-1.5 font-medium text-blue-700 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/40 px-2.5 py-1 rounded border border-blue-200 dark:border-blue-900">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Titular: <strong>Fabio César Herrera Bonilla</strong> <span className="font-mono text-[10px] opacity-75">(RUC 10762026835)</span>
            </span>
          )}
          {selectedOwner === 'peggy' && (
            <span className="inline-flex items-center gap-1.5 font-medium text-purple-700 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-950/40 px-2.5 py-1 rounded border border-purple-200 dark:border-purple-900">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              Titular: <strong>Peggy Liliana Bonilla Orduña</strong> <span className="font-mono text-[10px] opacity-75">(RUC 10091870911)</span>
            </span>
          )}
          {selectedOwner === 'all' && (
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded border border-slate-300">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              Vista consolidada: <strong>Fabio + Peggy</strong>
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 bg-card border">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            <span>Compras</span>
            <Package className="h-3.5 w-3.5 text-muted-foreground/70" />
          </p>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-foreground">{metrics.totalItems}</span>
            <span className="text-xs text-muted-foreground">({metrics.totalUnits} unids)</span>
          </div>
        </Card>

        <Card className="p-3 bg-card border">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            <span>Inversión USD</span>
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
            <span>Inversión PEN (3.40)</span>
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

        <Card className="p-3 bg-card border">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            <span>Ganancia Estimada</span>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          </p>
          <div className="mt-1">
            <span className={`text-lg font-bold ${metrics.totalGananciaPen >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
              S/ {metrics.totalGananciaPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        <Card className="p-3 bg-card border">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            <span>Estado Shiper</span>
            <Building2 className="h-3.5 w-3.5 text-emerald-600" />
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs flex-wrap">
            <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-300">
              ✓ {metrics.listosCount} OK
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300">
              📦 {metrics.embarcadosCount} Emb.
            </span>
          </div>
        </Card>
      </div>

      {/* View Mode Switcher: Tabla Inteligente con Fotos vs Excel Real Embebido (.xlsx) */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant={viewMode === 'smart' ? 'default' : 'outline'}
            onClick={() => setViewMode('smart')}
            className={`h-8 text-xs font-bold gap-1.5 ${
              viewMode === 'smart'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                : 'bg-background'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>⚡ Tabla Visual + Fotos eBay (Tiempo Real)</span>
          </Button>

          <Button
            size="sm"
            variant={viewMode === 'excel' && excelOwner === 'fabio' ? 'default' : 'outline'}
            onClick={() => {
              setViewMode('excel');
              setExcelOwner('fabio');
              setSelectedOwner('fabio');
              loadWorkbook('fabio', '', selectedExcelYear);
            }}
            className={`h-8 text-xs font-bold gap-1.5 ${
              viewMode === 'excel' && excelOwner === 'fabio'
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                : 'bg-background text-blue-700 dark:text-blue-300 border-blue-200'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>📊 Ver Excel Real FABIO (.xlsx)</span>
          </Button>

          <Button
            size="sm"
            variant={viewMode === 'excel' && excelOwner === 'liliana' ? 'default' : 'outline'}
            onClick={() => {
              setViewMode('excel');
              setExcelOwner('liliana');
              setSelectedOwner('peggy');
              loadWorkbook('liliana', '', selectedExcelYear);
            }}
            className={`h-8 text-xs font-bold gap-1.5 ${
              viewMode === 'excel' && excelOwner === 'liliana'
                ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                : 'bg-background text-purple-700 dark:text-purple-300 border-purple-200'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>📊 Ver Excel Real LILIANA (.xlsx)</span>
          </Button>
        </div>

        <span className="text-[11px] text-muted-foreground hidden md:inline">
          {viewMode === 'smart'
            ? 'Edita cualquier celda y se autoguarda en BD + Excels de Google Drive'
            : `Viendo documento real en vivo: ${excelFileName}`}
        </span>
      </div>

      {/* EMBEDDED REAL EXCEL (.XLSX) VIEWER */}
      {viewMode === 'excel' && (
        <Card className="border-2 border-emerald-600/30 overflow-hidden shadow-sm">
          {/* Excel Top Ribbon Bar */}
          <div className="bg-emerald-700 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="font-bold text-xs">{excelFileName}</span>

              {/* Selector de Año para el Excel Real */}
              <div className="flex items-center bg-black/25 rounded-md p-0.5 ml-2 border border-white/20">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExcelYear('2026');
                    loadWorkbook(excelOwner, '', '2026');
                  }}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                    selectedExcelYear === '2026'
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  2026 (Actual)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExcelYear('2025');
                    loadWorkbook(excelOwner, '', '2025');
                  }}
                  className={`px-2.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                    selectedExcelYear === '2025'
                      ? 'bg-white text-emerald-900 shadow-xs'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  2025 (Histórico)
                </button>
              </div>

              <Badge className="bg-white/20 text-white text-[10px] py-0">
                Google Drive Sincronizado
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => loadWorkbook(excelOwner, activeExcelSheet, selectedExcelYear)}
                disabled={loadingExcel}
                className="h-7 text-xs font-semibold gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loadingExcel ? 'animate-spin' : ''}`} />
                Refrescar Hoja
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const res = await fetch(`/api/compras/excel?owner=${excelOwner}&year=${selectedExcelYear}`, { method: 'POST' });
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = excelFileName;
                    a.click();
                  }
                }}
                className="h-7 text-xs font-bold bg-white text-emerald-800 hover:bg-emerald-50 gap-1"
              >
                <Download className="h-3 w-3" />
                Descargar este .xlsx
              </Button>
            </div>
          </div>

          {/* Sheet Tabs Bar (like Excel) */}
          <div className="flex items-center gap-1 px-3 py-1.5 bg-muted/70 border-b overflow-x-auto">
            <span className="text-[10px] font-bold uppercase text-muted-foreground mr-1">Pestañas:</span>
            {excelSheets.map((sh) => (
              <button
                key={sh}
                onClick={() => loadWorkbook(excelOwner, sh, selectedExcelYear)}
                className={`px-3 py-1 rounded-t-md text-xs font-mono transition-colors shrink-0 border-b-2 ${
                  activeExcelSheet === sh
                    ? 'bg-background text-emerald-700 dark:text-emerald-400 font-bold border-emerald-600 shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground border-transparent hover:bg-background/50'
                }`}
              >
                {sh}
              </button>
            ))}
          </div>

          {/* Excel Grid Content */}
          <div className="overflow-x-auto max-h-[68vh]">
            {loadingExcel ? (
              <div className="p-12 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
                <p className="text-xs font-medium">Leyendo celdas reales de {excelFileName}...</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-xs font-mono">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-900 text-muted-foreground border-b">
                    <th className="border-r px-2 py-1 text-center w-10 bg-slate-200/70 dark:bg-slate-800">#</th>
                    {(() => {
                      const colCount = excelRows.length > 0 ? Math.max(...excelRows.map((r) => r.length), 18) : 18;
                      return Array.from({ length: colCount }).map((_, cIdx) => (
                        <th key={cIdx} className="border-r px-2.5 py-1 text-center font-bold">
                          {cIdx < 26 ? String.fromCharCode(65 + cIdx) : `A${String.fromCharCode(65 + cIdx - 26)}`}
                        </th>
                      ));
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {excelRows.map((row, rIdx) => {
                    const isHeaderRow = rIdx === 0 || String(row[0] || '').toLowerCase().includes('fecha');
                    const colCount = excelRows.length > 0 ? Math.max(...excelRows.map((r) => r.length), 18) : 18;
                    return (
                      <tr
                        key={rIdx}
                        className={`border-b hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 ${
                          isHeaderRow ? 'bg-emerald-600/10 font-bold text-foreground' : ''
                        }`}
                      >
                        <td className="border-r px-2 py-1 text-center text-[10px] text-muted-foreground bg-slate-50 dark:bg-slate-900/50">
                          {rIdx + 1}
                        </td>
                        {Array.from({ length: colCount }).map((_, cIdx) => {
                          const cell = row[cIdx];
                          const isObj = cell && typeof cell === 'object' && 'hyperlink' in cell;
                          const cellText = isObj ? cell.text : String(cell ?? '');
                          const cellLink = isObj ? cell.hyperlink : null;

                          return (
                            <td
                              key={cIdx}
                              className={`border-r px-2.5 py-1.5 whitespace-nowrap max-w-[280px] truncate ${
                                cIdx === 6
                                  ? 'bg-slate-50/60 dark:bg-slate-900/40'
                                  : cIdx === 7
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 font-semibold text-emerald-900 dark:text-emerald-300'
                                  : ''
                              }`}
                              title={cellText}
                            >
                              {cellLink ? (
                                <a
                                  href={cellLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                                >
                                  <span>{cellText}</span>
                                  <ExternalLink className="h-2.5 w-2.5 opacity-60 shrink-0" />
                                </a>
                              ) : (
                                cellText
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {/* Navigation Controls: Year Tabs & Month Tabs */}
      <div className={viewMode === 'excel' ? 'hidden' : 'space-y-2 pt-1'}>
        {/* Row 1: Year Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mr-1">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Año:
            </span>
            <div className="flex items-center gap-1.5">
              {years.map((y) => (
                <Button
                  key={y}
                  size="sm"
                  variant={selectedYear === y ? 'default' : 'outline'}
                  onClick={() => {
                    setSelectedYear(y);
                    const monthsForY = monthsStructure[y] || [];
                    if (y === '2026' && monthsForY.includes('SEPTIEMBRE')) {
                      setSelectedMonth('SEPTIEMBRE');
                    } else if (monthsForY.length > 0) {
                      setSelectedMonth(monthsForY[0]);
                    } else {
                      setSelectedMonth('ALL');
                    }
                  }}
                  className={`h-8 px-3 text-xs font-bold gap-1.5 ${
                    selectedYear === y
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span>{y}</span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${
                      selectedYear === y
                        ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                        : 'bg-muted-foreground/10 text-muted-foreground'
                    }`}
                  >
                    {yearCounts[y] || 0}
                  </Badge>
                </Button>
              ))}

              <Button
                size="sm"
                variant={selectedYear === 'ALL' ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedYear('ALL');
                  setSelectedMonth('ALL');
                }}
                className={`h-8 px-3 text-xs font-bold gap-1.5 ${
                  selectedYear === 'ALL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'hover:bg-muted'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Todos los Años</span>
                <Badge
                  variant="secondary"
                  className={`text-[10px] px-1.5 py-0 ${
                    selectedYear === 'ALL'
                      ? 'bg-white/20 text-white'
                      : 'bg-muted-foreground/10 text-muted-foreground'
                  }`}
                >
                  {yearCounts.ALL || 0}
                </Badge>
              </Button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por orden, tracking, modelo..."
              className="h-8 pl-8 pr-7 text-xs bg-background"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Month Sub-Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <Button
            size="sm"
            variant={selectedMonth === 'ALL' ? 'default' : 'outline'}
            onClick={() => setSelectedMonth('ALL')}
            className={`h-7 px-2.5 text-xs font-semibold shrink-0 gap-1 ${
              selectedMonth === 'ALL'
                ? 'bg-emerald-600 text-white'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>Todo {selectedYear === 'ALL' ? 'el Historial' : selectedYear}</span>
            <span className="text-[10px] opacity-75">
              ({(() => {
                let list = products;
                if (selectedOwner === 'fabio') list = list.filter((p) => !isPeggyItem(p));
                else if (selectedOwner === 'peggy') list = list.filter((p) => isPeggyItem(p));
                return selectedYear === 'ALL' ? list.length : list.filter((p) => p.year === selectedYear).length;
              })()})
            </span>
          </Button>

          {availableMonths.map((m) => {
            let list = products;
            if (selectedOwner === 'fabio') list = list.filter((p) => !isPeggyItem(p));
            else if (selectedOwner === 'peggy') list = list.filter((p) => isPeggyItem(p));
            const count = list.filter(
              (p) => (selectedYear === 'ALL' || p.year === selectedYear) && p.monthName === m
            ).length;
            const isSelected = selectedMonth === m;

            return (
              <Button
                key={m}
                size="sm"
                variant={isSelected ? 'default' : 'outline'}
                onClick={() => setSelectedMonth(m)}
                className={`h-7 px-2.5 text-xs font-medium shrink-0 gap-1 ${
                  isSelected
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{m}</span>
                <span className="text-[10px] opacity-70 font-mono">({count})</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Spreadsheet Table with Inline Real-Time Auto-Save */}
      <div className={viewMode === 'excel' ? 'hidden' : 'rounded-lg border bg-card overflow-hidden shadow-xs'}>
        <div className="overflow-x-auto max-h-[70vh]">
          <Table className="text-xs">
            <TableHeader className="bg-muted/70 sticky top-0 z-10 text-[11px]">
              <TableRow>
                <TableHead className="w-[36px] text-center font-bold">#</TableHead>
                <TableHead className="w-[125px]">Fecha Compra</TableHead>
                <TableHead className="w-[80px] text-center font-bold">Titular</TableHead>
                <TableHead className="w-[50px] text-center">Sis.</TableHead>
                <TableHead className="w-[95px] text-center">Shiper / Emb.</TableHead>
                <TableHead className="w-[130px]">N° Orden</TableHead>
                <TableHead className="w-[65px] text-center">Courier</TableHead>
                <TableHead className="w-[145px]">
                  <span>Tracking Original</span>
                  <span className="block text-[9px] font-normal text-muted-foreground">Carrier (Izquierda)</span>
                </TableHead>
                <TableHead className="w-[195px] bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-300 font-bold border-x border-emerald-200/50">
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-600" />
                    Tracking Shiper (Embarque)
                  </span>
                  <span className="block text-[9px] font-normal text-emerald-700/80 dark:text-emerald-400/80">Para correo de embarque (Derecha)</span>
                </TableHead>
                <TableHead className="w-[95px]">Proveedor</TableHead>
                <TableHead className="min-w-[260px]">Foto & Producto eBay</TableHead>
                <TableHead className="w-[100px] text-center bg-amber-50/50 dark:bg-amber-950/20 font-bold text-amber-900 dark:text-amber-300">
                  Modelo (SUNAT)
                </TableHead>
                <TableHead className="w-[85px] text-right font-bold text-foreground">Compra $</TableHead>
                <TableHead className="w-[90px] text-right font-medium text-muted-foreground">Compra S/</TableHead>
                <TableHead className="w-[95px] text-right text-purple-700 dark:text-purple-300 font-bold">Venta S/</TableHead>
                <TableHead className="w-[80px] text-right text-muted-foreground">Pub. $</TableHead>
                <TableHead className="w-[80px] text-right text-muted-foreground">Extra $</TableHead>
                <TableHead className="w-[95px] text-right text-emerald-700 dark:text-emerald-400 font-bold">Ganancia S/</TableHead>
                <TableHead className="w-[55px] text-center">Stock</TableHead>
                <TableHead className="w-[95px] text-right text-blue-700 dark:text-blue-300 font-medium">Sugerido S/</TableHead>
                <TableHead className="w-[45px] text-center">Auto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={21} className="py-12 text-center text-muted-foreground">
                    <FileSpreadsheet className="h-8 w-8 mx-auto opacity-40 mb-2" />
                    <p className="font-medium">No hay compras registradas para este filtro.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((r, idx) => {
                  const keyModel = `${r.id}_model`;
                  const keySale = `${r.id}_salePricePen`;
                  const keyAdv = `${r.id}_advertisingCostUsd`;
                  const keyExtra = `${r.id}_extraCostsUsd`;
                  const keyStock = `${r.id}_quantity`;
                  const keySug = `${r.id}_suggestedPricePen`;

                  const isRowSaving =
                    saveStatus[keyModel] === 'saving' ||
                    saveStatus[keySale] === 'saving' ||
                    saveStatus[keyAdv] === 'saving' ||
                    saveStatus[keyExtra] === 'saving' ||
                    saveStatus[keyStock] === 'saving' ||
                    saveStatus[keySug] === 'saving';

                  const isRowSaved =
                    saveStatus[keyModel] === 'saved' ||
                    saveStatus[keySale] === 'saved' ||
                    saveStatus[keyAdv] === 'saved' ||
                    saveStatus[keyExtra] === 'saved' ||
                    saveStatus[keyStock] === 'saved' ||
                    saveStatus[keySug] === 'saved';

                  const trackingUrl = getCourierTrackingUrl(r.courier, r.trackingNumber);

                  return (
                    <TableRow key={r.id || idx} className="hover:bg-muted/40 transition-colors">
                      {/* # */}
                      <TableCell className="text-center font-mono text-muted-foreground text-[11px] font-semibold">
                        {idx + 1}
                      </TableCell>

                      {/* Fecha Compra */}
                      <TableCell className="font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                        {r.fechaCompraFormatted}
                      </TableCell>

                      {/* Titular */}
                      <TableCell className="text-center whitespace-nowrap">
                        {isPeggyItem(r) ? (
                          <Badge
                            variant="outline"
                            className="bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 text-[10px] px-1.5 py-0 font-bold"
                          >
                            👩 Peggy
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 text-[10px] px-1.5 py-0 font-bold"
                          >
                            👤 Fabio
                          </Badge>
                        )}
                      </TableCell>

                      {/* Sistema */}
                      <TableCell className="text-center">
                        {r.isArchived || r.shippingStatus === 'ENTREGADO_LIMA' || r.shipperConfirmed ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[10px] px-1.5 py-0 font-bold"
                            title="En sistema de almacén Miami (Verificado por Shiper)"
                          >
                            SI
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 text-[10px] px-1.5 py-0 font-bold"
                            title="No figura en sistema de almacén Miami (Aún no recibido por Shiper)"
                          >
                            NO
                          </Badge>
                        )}
                      </TableCell>

                      {/* Shiper / Embarcado - 1-Click Toggle */}
                      <TableCell className="text-center">
                        {r.isArchived ? (
                          <button
                            type="button"
                            onClick={() => handleToggleArchived(r)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-700 hover:bg-slate-800 text-white cursor-pointer transition-colors"
                            title="Marcado como Embarcado a Perú. Clic si fue un error para desmarcar y regresar a Miami (Activo)."
                          >
                            ✓ Embarcado
                          </button>
                        ) : r.shipperConfirmed ? (
                          <button
                            type="button"
                            onClick={() => handleToggleShipperConfirmed(r)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 hover:bg-amber-100 text-emerald-800 border border-emerald-300 cursor-pointer transition-colors"
                            title="Listo en Miami (Shiper OK). Clic para marcar Pendiente."
                          >
                            <Check className="h-2.5 w-2.5 text-emerald-600" />
                            Shiper OK
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleShipperConfirmed(r)}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 hover:bg-emerald-50 text-amber-800 border border-amber-300 cursor-pointer transition-colors"
                            title="Pendiente en Miami. Clic para marcar Listo (Shiper OK)."
                          >
                            ⏳ Pendiente
                          </button>
                        )}
                      </TableCell>

                      {/* N° Orden */}
                      <TableCell>
                        <div className="flex items-center gap-1 font-mono text-xs">
                          <span className="font-semibold text-foreground">{r.orderNumber}</span>
                          {(r.orderUrl || (r.orderNumber && (r.orderNumber.includes('-') || /^\d{10,}$/.test(r.orderNumber)))) && (
                            <a
                              href={r.orderUrl || `https://order.ebay.com/ord/show?orderId=${r.orderNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-600 hover:text-orange-700 shrink-0"
                              title="Ver orden en eBay"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopy(r.orderNumber, `ord-${r.id}`, 'N° Orden')}
                            className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                          >
                            {copiedId === `ord-${r.id}` ? (
                              <Check className="h-2.5 w-2.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-2.5 w-2.5" />
                            )}
                          </button>
                        </div>
                      </TableCell>

                      {/* Courier */}
                      <TableCell className="text-center font-semibold text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-muted text-foreground border text-[10px]">
                          {r.courier || 'USPS'}
                        </span>
                      </TableCell>

                      {/* Casilla Izquierda: Tracking Original (Carrier) */}
                      <TableCell>
                        <div className="flex items-center gap-1 font-mono text-[11px] truncate max-w-[145px]">
                          {r.originalTracking || r.trackingNumber ? (
                            <a
                              href={getCourierTrackingUrl(r.courier, r.originalTracking || r.trackingNumber)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground hover:text-primary hover:underline truncate"
                              title={`${r.originalTracking || r.trackingNumber} - Clic para rastrear en ${r.courier}`}
                            >
                              {r.originalTracking || r.trackingNumber}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                          {(r.originalTracking || r.trackingNumber) && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  r.originalTracking || r.trackingNumber,
                                  `tr-orig-${r.id}`,
                                  'Tracking Original'
                                )
                              }
                              className="p-0.5 text-muted-foreground hover:text-foreground shrink-0"
                              title="Copiar Tracking Original"
                            >
                              {copiedId === `tr-orig-${r.id}` ? (
                                <Check className="h-2.5 w-2.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-2.5 w-2.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>

                      {/* Casilla Derecha: Tracking Shiper (Embarque) */}
                      <TableCell className="bg-emerald-50/30 dark:bg-emerald-950/10 border-x border-emerald-200/40">
                        <div className="flex items-center justify-between gap-1 font-mono text-[11px]">
                          <div className="truncate max-w-[155px]">
                            {r.shipperConfirmed || r.isArchived ? (
                              r.shipperTracking ? (
                                <div className="space-y-0.5">
                                  <span
                                    className={`truncate block font-semibold ${
                                      r.shipperTracking !== (r.originalTracking || r.trackingNumber)
                                        ? 'text-emerald-800 dark:text-emerald-300 font-bold'
                                        : 'text-foreground'
                                    }`}
                                    title={`Tracking Shiper para correo de embarque: ${r.shipperTracking}`}
                                  >
                                    {r.shipperTracking}
                                  </span>
                                  {r.shipperTracking !== (r.originalTracking || r.trackingNumber) && (
                                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium block">
                                      ★ Dígitos Shiper
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-foreground font-semibold">
                                  {r.originalTracking || r.trackingNumber || '-'}
                                </span>
                              )
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400 font-medium italic text-[10px]" title="No verificado por Shiper en Miami">
                                No figura en sistema
                              </span>
                            )}
                          </div>
                          {(r.shipperConfirmed || r.isArchived) && (r.shipperTracking || r.originalTracking || r.trackingNumber) && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  r.shipperTracking || r.originalTracking || r.trackingNumber,
                                  `tr-ship-${r.id}`,
                                  'Tracking Shiper para Correo'
                                )
                              }
                              className="p-1 text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 hover:bg-emerald-100 rounded shrink-0"
                              title="Copiar Tracking Shiper para correo de embarque"
                            >
                              {copiedId === `tr-ship-${r.id}` ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </TableCell>

                      {/* Proveedor */}
                      <TableCell>
                        {r.supplierUrl ? (
                          <a
                            href={r.supplierUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline truncate max-w-[95px] block text-[11px]"
                            title={r.supplier}
                          >
                            {r.supplier}
                          </a>
                        ) : (
                          <span className="truncate max-w-[95px] block text-[11px]">{r.supplier}</span>
                        )}
                      </TableCell>

                      {/* Foto & Descripción */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {r.imageUrl && (
                            <a
                              href={r.itemUrl || r.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 h-9 w-9 rounded border bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center p-0.5 hover:ring-2 hover:ring-emerald-500 transition-all"
                              title={r.itemUrl ? "Ver publicación del producto en eBay" : "Ver foto original"}
                            >
                              <img
                                src={r.imageUrl}
                                alt={r.description}
                                loading="lazy"
                                className="max-h-8 max-w-8 object-contain"
                              />
                            </a>
                          )}
                          {r.itemUrl ? (
                            <a
                              href={r.itemUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="line-clamp-2 text-[11px] leading-tight text-foreground hover:text-primary hover:underline font-medium inline-flex items-center gap-1 group/link"
                              title={`Ver publicación en eBay: ${r.description}`}
                            >
                              <span>{r.description}</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0 text-primary" />
                            </a>
                          ) : (
                            <p className="line-clamp-2 text-[11px] leading-tight text-foreground/90 font-medium" title={r.description}>
                              {r.description}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* MODELO (SUNAT) - INLINE EDITABLE CON AUTOGUARDADO EN BD */}
                      <TableCell className="text-center bg-amber-50/30 dark:bg-amber-950/10 p-1">
                        <Input
                          value={editBuffer[keyModel] ?? r.model ?? ''}
                          placeholder="ej: A1701"
                          onChange={(e) =>
                            setEditBuffer((prev) => ({ ...prev, [keyModel]: e.target.value }))
                          }
                          onBlur={(e) =>
                            handleAutoSave(r.id, 'model', e.target.value, r.model)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className={`h-7 w-20 text-center font-mono font-bold text-xs uppercase px-1 py-0.5 border ${
                            saveStatus[keyModel] === 'saved'
                              ? 'border-emerald-500 bg-emerald-50/50 text-emerald-800'
                              : saveStatus[keyModel] === 'saving'
                              ? 'border-blue-500 bg-blue-50/50'
                              : 'border-amber-300 dark:border-amber-800/60 bg-background text-foreground'
                          }`}
                          title="Modelo técnico SUNAT (A####). Autoguardado instantáneo al salir."
                        />
                      </TableCell>

                      {/* Compra $ */}
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        ${Number(r.orderTotalUsd || 0).toFixed(2)}
                      </TableCell>

                      {/* Compra S/ */}
                      <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                        S/ {Number(r.purchasePricePen || 0).toFixed(2)}
                      </TableCell>

                      {/* VENTA S/ - INLINE EDITABLE CON AUTOGUARDADO */}
                      <TableCell className="text-right font-mono p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={editBuffer[keySale] ?? (r.salePricePen ? String(r.salePricePen) : '')}
                          placeholder="0.00"
                          onChange={(e) =>
                            setEditBuffer((prev) => ({ ...prev, [keySale]: e.target.value }))
                          }
                          onBlur={(e) =>
                            handleAutoSave(r.id, 'salePricePen', e.target.value, r.salePricePen)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className={`h-7 w-20 text-right font-mono font-bold text-xs px-1 py-0.5 border text-purple-700 dark:text-purple-300 ${
                            saveStatus[keySale] === 'saved'
                              ? 'border-emerald-500 bg-emerald-50/50'
                              : saveStatus[keySale] === 'saving'
                              ? 'border-blue-500 bg-blue-50/50'
                              : 'border-input bg-background'
                          }`}
                          title="Precio de venta en soles. Autoguardado al salir."
                        />
                      </TableCell>

                      {/* PUBLICIDAD $ - INLINE EDITABLE CON AUTOGUARDADO */}
                      <TableCell className="text-right font-mono p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={editBuffer[keyAdv] ?? (r.advertisingCostUsd ? String(r.advertisingCostUsd) : '')}
                          placeholder="0.00"
                          onChange={(e) =>
                            setEditBuffer((prev) => ({ ...prev, [keyAdv]: e.target.value }))
                          }
                          onBlur={(e) =>
                            handleAutoSave(r.id, 'advertisingCostUsd', e.target.value, r.advertisingCostUsd)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className={`h-7 w-16 text-right font-mono text-xs px-1 py-0.5 border text-muted-foreground ${
                            saveStatus[keyAdv] === 'saved'
                              ? 'border-emerald-500 bg-emerald-50/50'
                              : saveStatus[keyAdv] === 'saving'
                              ? 'border-blue-500 bg-blue-50/50'
                              : 'border-input bg-background'
                          }`}
                          title="Costo de publicidad en dólares. Autoguardado al salir."
                        />
                      </TableCell>

                      {/* COSTOS EXTRA $ - INLINE EDITABLE CON AUTOGUARDADO */}
                      <TableCell className="text-right font-mono p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={editBuffer[keyExtra] ?? (r.extraCostsUsd ? String(r.extraCostsUsd) : '')}
                          placeholder="0.00"
                          onChange={(e) =>
                            setEditBuffer((prev) => ({ ...prev, [keyExtra]: e.target.value }))
                          }
                          onBlur={(e) =>
                            handleAutoSave(r.id, 'extraCostsUsd', e.target.value, r.extraCostsUsd)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className={`h-7 w-16 text-right font-mono text-xs px-1 py-0.5 border text-muted-foreground ${
                            saveStatus[keyExtra] === 'saved'
                              ? 'border-emerald-500 bg-emerald-50/50'
                              : saveStatus[keyExtra] === 'saving'
                              ? 'border-blue-500 bg-blue-50/50'
                              : 'border-input bg-background'
                          }`}
                          title="Costos adicionales en dólares. Autoguardado al salir."
                        />
                      </TableCell>

                      {/* Ganancia S/ (Cálculo en vivo) */}
                      <TableCell className="text-right font-mono font-bold">
                        {r.salePricePen > 0 ? (
                          <span className={r.profitPen >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            S/ {Number(r.profitPen || 0).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      {/* STOCK - INLINE EDITABLE CON AUTOGUARDADO */}
                      <TableCell className="text-center font-mono p-1">
                        <Input
                          type="number"
                          min="1"
                          value={editBuffer[keyStock] ?? String(r.quantity || 1)}
                          onChange={(e) =>
                            setEditBuffer((prev) => ({ ...prev, [keyStock]: e.target.value }))
                          }
                          onBlur={(e) =>
                            handleAutoSave(r.id, 'quantity', e.target.value, r.quantity)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className={`h-7 w-12 text-center font-mono font-semibold text-xs px-1 py-0.5 border ${
                            saveStatus[keyStock] === 'saved'
                              ? 'border-emerald-500 bg-emerald-50/50'
                              : saveStatus[keyStock] === 'saving'
                              ? 'border-blue-500 bg-blue-50/50'
                              : 'border-input bg-background'
                          }`}
                          title="Cantidad de unidades en stock. Autoguardado al salir."
                        />
                      </TableCell>

                      {/* SUGERIDO S/ - INLINE EDITABLE CON AUTOGUARDADO */}
                      <TableCell className="text-right font-mono text-blue-600 dark:text-blue-400 p-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={editBuffer[keySug] ?? (r.suggestedPricePen ? String(r.suggestedPricePen) : '')}
                          placeholder="0.00"
                          onChange={(e) =>
                            setEditBuffer((prev) => ({ ...prev, [keySug]: e.target.value }))
                          }
                          onBlur={(e) =>
                            handleAutoSave(r.id, 'suggestedPricePen', e.target.value, r.suggestedPricePen)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className={`h-7 w-20 text-right font-mono text-xs px-1 py-0.5 border text-blue-600 dark:text-blue-400 ${
                            saveStatus[keySug] === 'saved'
                              ? 'border-emerald-500 bg-emerald-50/50'
                              : saveStatus[keySug] === 'saving'
                              ? 'border-blue-500 bg-blue-50/50'
                              : 'border-input bg-background'
                          }`}
                          title="Precio sugerido en soles. Autoguardado al salir."
                        />
                      </TableCell>

                      {/* Auto-Save Indicator */}
                      <TableCell className="text-center">
                        {isRowSaving ? (
                          <span title="Guardando en BD..." className="inline-flex items-center justify-center">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 mx-auto" />
                          </span>
                        ) : isRowSaved ? (
                          <span title="Guardado en tiempo real en PostgreSQL" className="inline-flex items-center justify-center">
                            <CheckCheck className="h-3.5 w-3.5 text-emerald-600 mx-auto" />
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 font-mono">ok</span>
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
