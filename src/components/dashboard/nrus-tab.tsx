'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  Copy,
  Check,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Sparkles,
  Info,
  Settings,
  ArrowRightLeft,
  ExternalLink,
  Clock,
  CheckCircle2,
  CalendarDays,
  FileText,
  HelpCircle,
  Save,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { fetchNRUSStatus, fetchNRUSConfig, updateNRUSConfig, saveNRUSDeclaredSales } from '@/lib/api';
import type { NRUSStatus, NRUSConfig, NRUSProfileStatus, NRUSMonthHistoryItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUSD(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function NRUSTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState<NRUSStatus | null>(null);
  const [config, setConfig] = useState<NRUSConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'fabio' | 'peggy' | 'historial' | 'consolidado' | 'config'>('fabio');
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savingSalesFor, setSavingSalesFor] = useState<string | null>(null);

  // Editable config form
  const [cat1Limit, setCat1Limit] = useState('5000');
  const [cat2Limit, setCat2Limit] = useState('8000');
  const [igvRate, setIgvRate] = useState('18');
  const [adValoremRate, setAdValoremRate] = useState('4');
  const [percepcionRate, setPercepcionRate] = useState('10');

  // History filter
  const [historyYearFilter, setHistoryYearFilter] = useState<'all' | '2026' | '2025'>('all');

  const loadData = useCallback(async (month?: string) => {
    try {
      setLoading(true);
      const targetMonth = month || selectedMonth;
      const [s, c] = await Promise.all([
        fetchNRUSStatus(targetMonth),
        fetchNRUSConfig(),
      ]);
      setStatus(s);
      setConfig(c);
      setCat1Limit(c.category1Limit.toString());
      setCat2Limit(c.category2Limit.toString());
      setIgvRate(c.igvRate.toString());
      setAdValoremRate(c.adValoremRate.toString());
      setPercepcionRate(c.percepcionRate.toString());
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información tributaria NRUS',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyGuia = (profile: NRUSProfileStatus) => {
    const text = `GUÍA PAGO FÁCIL NUEVO RUS - SUNAT (FORMULARIO 1611)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Titular: ${profile.name}
RUC: ${profile.ruc} (Último dígito: ${profile.ruc.slice(-1)})
Período Tributario (007): ${profile.guiaPagoFacil.periodo}
¿Es declaración rectificatoria?: NO
Total Ingresos Brutos / Ventas (507): S/ ${profile.guiaPagoFacil.ingresosBrutosPen.toLocaleString('es-PE')}
Total Adquisiciones / Compras (607): S/ ${profile.guiaPagoFacil.adquisicionesPen.toLocaleString('es-PE')}
Categoría Determinada (400): ${profile.guiaPagoFacil.categoria}
Monto de Cuota Mensual (503): S/ ${profile.guiaPagoFacil.importePagarPen}.00
Interés Moratorio (504): S/ ${profile.guiaPagoFacil.interesMoratorioPen || 0}.00
Compensación Percepciones IGV (509): S/ ${profile.guiaPagoFacil.compensacionPercepcionesPen || 0}.00
IMPORTE TOTAL A PAGAR (505): S/ ${profile.guiaPagoFacil.importePagarPen}.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fecha Límite SUNAT: ${profile.guiaPagoFacil.fechaVencimiento || 'Según calendario'}
Estado: ${profile.guiaPagoFacil.estadoPlazo || 'En regla'}
T.C. Oficial Aplicado: S/ 3.40 (eBay USD a Soles)`;

    navigator.clipboard.writeText(text);
    setCopiedKey(profile.importerKey);
    setTimeout(() => setCopiedKey(null), 2500);
    toast({
      title: 'Guía Formulario 1611 Copiada',
      description: `Casillas listas para pegar en el portal SUNAT Virtual para ${profile.name}.`,
    });
  };

  const handleCopySingleField = (label: string, value: string) => {
    navigator.clipboard.writeText(value);
    toast({
      title: `${label} copiado`,
      description: `Valor: ${value}`,
      duration: 1500,
    });
  };

  const handleSaveDeclaredSales = async (importerKey: 'fabio' | 'peggy', salesPen: number) => {
    try {
      setSavingSalesFor(importerKey);
      await saveNRUSDeclaredSales({
        month: selectedMonth,
        importerKey,
        declaredSalesPen: salesPen,
      });
      toast({
        title: 'Ventas declaradas actualizadas',
        description: `Casilla 507 guardada en base de datos para ${importerKey.toUpperCase()}: S/ ${salesPen.toLocaleString('es-PE')}`,
      });
      await loadData(selectedMonth);
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron guardar las ventas declaradas',
        variant: 'destructive',
      });
    } finally {
      setSavingSalesFor(null);
    }
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await updateNRUSConfig({
        category1Limit: parseFloat(cat1Limit) || 5000,
        category2Limit: parseFloat(cat2Limit) || 8000,
        igvRate: parseFloat(igvRate) || 18,
        adValoremRate: parseFloat(adValoremRate) || 4,
        percepcionRate: parseFloat(percepcionRate) || 10,
      });
      toast({
        title: 'Configuración guardada',
        description: 'Los umbrales tributarios NRUS se actualizaron correctamente.',
      });
      await loadData();
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const fabio = status?.byImporter?.fabio;
  const peggy = status?.byImporter?.peggy;
  const availableMonths = status?.availableMonths || [
    { month: '2026-09', label: 'Setiembre 2026', year: 2026 },
    { month: '2026-08', label: 'Agosto 2026', year: 2026 },
  ];

  const filteredHistory = (status?.annualHistory || []).filter((item) => {
    if (historyYearFilter === 'all') return true;
    return item.year.toString() === historyYearFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight">Control Tributario SUNAT — Nuevo RUS</h2>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400">
              Formulario Virtual Nº 1611
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-400">
              Bi-RUC Sincronizado
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cálculo mensual automático de compras reales vs ventas, simulador oficial del Form. 1611 y cronograma de vencimiento por dígito de RUC
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Dynamic Period selector */}
          <div className="flex items-center gap-1.5 bg-card border rounded-lg px-2.5 py-1 text-xs shadow-xs">
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-muted-foreground font-medium">Período:</span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                const newMonth = e.target.value;
                setSelectedMonth(newMonth);
                loadData(newMonth);
              }}
              className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m.month} value={m.month} className="bg-card text-foreground">
                  {m.label} ({m.month})
                </option>
              ))}
            </select>
          </div>

          <Badge variant="secondary" className="text-xs px-2.5 py-1 font-mono">
            T.C. S/ 3.40
          </Badge>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SMART PURCHASE ALERT & RECOMMENDATION BANNER                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {status?.recommendation && (
        <Card
          className={`border overflow-hidden shadow-xs transition-all ${
            status.recommendation.severity === 'critical'
              ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/25'
              : status.recommendation.severity === 'warning'
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/25'
              : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
          }`}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    status.recommendation.severity === 'critical'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                      : status.recommendation.severity === 'warning'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-foreground">
                      {status.recommendation.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold ${
                        status.recommendation.severity === 'critical'
                          ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300'
                          : status.recommendation.severity === 'warning'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      Límite RUS: S/ 8,000 / mes
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {status.recommendation.description}
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground pt-0.5">
                    👉 {status.recommendation.actionBanner}
                  </p>
                </div>
              </div>

              {/* Action Button: Copy Recommended RUC */}
              {status.recommendation.targetRuc && (
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                  <Button
                    onClick={() => {
                      if (!status.recommendation) return;
                      navigator.clipboard.writeText(status.recommendation.targetRuc);
                      toast({
                        title: 'RUC Copiado',
                        description: `RUC ${status.recommendation.targetRuc} (${status.recommendation.targetName}) listo para usar en eBay/Shipper.`,
                      });
                    }}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar RUC {status.recommendation.target === 'fabio' ? 'Fabio' : 'Peggy'} ({status.recommendation.targetRuc})
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Bi-RUC KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Inversión en Compras del Mes */}
        <Card className="border-border/60 shadow-xs relative overflow-hidden">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                Compras ({status?.periodoSunat})
              </span>
              <Badge variant="secondary" className="text-[11px] font-mono">
                {status?.purchasesCount || 0} equipos
              </Badge>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatPEN(status?.monthlyPurchases || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatUSD(status?.monthlyPurchasesUsd || 0)} USD importado
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Ventas Declaradas del Mes */}
        <Card className="border-border/60 shadow-xs relative overflow-hidden">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Ventas ({status?.periodoSunat})
              </span>
              <Badge variant="outline" className="text-[11px] font-mono bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40">
                Casilla 507
              </Badge>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatPEN(status?.monthlySales || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ingresos brutos declarados
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Estado RUC Fabio */}
        <Card className="border-border/60 shadow-xs relative overflow-hidden">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                Fabio (Dígito 5)
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  fabio?.category === 'Cat 1'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : fabio?.category === 'Cat 2'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-red-50 text-red-700 border-red-300'
                }`}
              >
                {fabio?.category || 'Cat 1'} • S/ {fabio?.monthlyQuotaPen || 20}
              </Badge>
            </div>
            <p className="text-xl font-bold tracking-tight text-foreground">
              {formatPEN(fabio?.monthlyPurchasesPen || 0)}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>{fabio?.purchasesCount} equipos</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Disp: {formatPEN(fabio?.availablePurchasesPen || Math.max(8000 - (fabio?.monthlyPurchasesPen || 0), 0))}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Estado RUC Peggy */}
        <Card className="border-border/60 shadow-xs relative overflow-hidden">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-purple-600" />
                Peggy (Dígito 1)
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  peggy?.category === 'Cat 1'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : peggy?.category === 'Cat 2'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-red-50 text-red-700 border-red-300'
                }`}
              >
                {peggy?.category || 'Cat 1'} • {peggy?.category === 'Excedido' ? '¡Tope Superado!' : `S/ ${peggy?.monthlyQuotaPen || 20}`}
              </Badge>
            </div>
            <p className="text-xl font-bold tracking-tight text-foreground">
              {formatPEN(peggy?.monthlyPurchasesPen || 0)}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>{peggy?.purchasesCount} equipos</span>
              <span className={`font-semibold ${peggy && peggy.monthlyPurchasesPen > 8000 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'}`}>
                {peggy && peggy.monthlyPurchasesPen > 8000 ? `Exceso: ${formatPEN(peggy.monthlyPurchasesPen - 8000)}` : `Disp: ${formatPEN(peggy?.availablePurchasesPen || 0)}`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 max-w-3xl h-auto p-1 gap-1">
          <TabsTrigger value="fabio" className="text-xs font-medium gap-1.5 py-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            Fabio (Dígito 5)
          </TabsTrigger>
          <TabsTrigger value="peggy" className="text-xs font-medium gap-1.5 py-2">
            <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
            Peggy (Dígito 1)
          </TabsTrigger>
          <TabsTrigger value="historial" className="text-xs font-medium gap-1.5 py-2">
            <CalendarDays className="h-3.5 w-3.5 text-emerald-600" />
            Historial 2025-2026
          </TabsTrigger>
          <TabsTrigger value="consolidado" className="text-xs font-medium gap-1.5 py-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            Consolidado
          </TabsTrigger>
          <TabsTrigger value="config" className="text-xs font-medium gap-1.5 py-2">
            <Settings className="h-3.5 w-3.5" />
            Umbrales
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 1: FABIO CESAR (RUC 10762026835)                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="fabio" className="space-y-6">
          {fabio && (
            <ProfileNRUSSection
              profile={fabio}
              cat1Limit={status?.category1Limit || 5000}
              cat2Limit={status?.category2Limit || 8000}
              onCopyGuia={() => handleCopyGuia(fabio)}
              onCopyField={handleCopySingleField}
              onSaveSales={(sales) => handleSaveDeclaredSales('fabio', sales)}
              isSavingSales={savingSalesFor === 'fabio'}
              copied={copiedKey === 'fabio'}
            />
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 2: PEGGY LILIANA (RUC 10091870911)                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="peggy" className="space-y-6">
          {peggy && (
            <ProfileNRUSSection
              profile={peggy}
              cat1Limit={status?.category1Limit || 5000}
              cat2Limit={status?.category2Limit || 8000}
              onCopyGuia={() => handleCopyGuia(peggy)}
              onCopyField={handleCopySingleField}
              onSaveSales={(sales) => handleSaveDeclaredSales('peggy', sales)}
              isSavingSales={savingSalesFor === 'peggy'}
              copied={copiedKey === 'peggy'}
            />
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 3: MATRIZ HISTÓRICA ANUAL (2025 - 2026)                    */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="historial" className="space-y-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-base">Historial y Cronograma Mensual de Declaraciones (2025 - 2026)</CardTitle>
                  </div>
                  <CardDescription>
                    Mapeo de compras reales, ventas declaradas (Casilla 507), categorías y fechas de vencimiento oficial de SUNAT por RUC
                  </CardDescription>
                </div>

                <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg">
                  <Button
                    variant={historyYearFilter === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    className="text-xs h-7 px-2.5"
                    onClick={() => setHistoryYearFilter('all')}
                  >
                    Todos ({status?.annualHistory?.length || 0})
                  </Button>
                  <Button
                    variant={historyYearFilter === '2026' ? 'default' : 'ghost'}
                    size="sm"
                    className="text-xs h-7 px-2.5"
                    onClick={() => setHistoryYearFilter('2026')}
                  >
                    2026
                  </Button>
                  <Button
                    variant={historyYearFilter === '2025' ? 'default' : 'ghost'}
                    size="sm"
                    className="text-xs h-7 px-2.5"
                    onClick={() => setHistoryYearFilter('2025')}
                  >
                    2025
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/70 text-muted-foreground uppercase text-[11px] font-semibold border-b">
                    <tr>
                      <th className="px-3 py-2.5">Período (007)</th>
                      <th className="px-3 py-2.5">Total Compras</th>
                      <th className="px-3 py-2.5">Equipos</th>
                      <th className="px-3 py-2.5 bg-blue-50/50 dark:bg-blue-950/20">Fabio (Compras / Ventas)</th>
                      <th className="px-3 py-2.5 bg-blue-50/50 dark:bg-blue-950/20">Fabio (Vence / Cuota)</th>
                      <th className="px-3 py-2.5 bg-purple-50/50 dark:bg-purple-950/20">Peggy (Compras / Ventas)</th>
                      <th className="px-3 py-2.5 bg-purple-50/50 dark:bg-purple-950/20">Peggy (Vence / Cuota)</th>
                      <th className="px-3 py-2.5 text-right">Cuota Total</th>
                      <th className="px-3 py-2.5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredHistory.map((item) => {
                      const totalCuota = item.fabio.quota + item.peggy.quota;
                      const isCurrent = item.monthKey === selectedMonth;

                      return (
                        <tr
                          key={item.monthKey}
                          className={`hover:bg-muted/40 transition-colors ${
                            isCurrent ? 'bg-emerald-50/40 dark:bg-emerald-950/20 font-medium' : ''
                          }`}
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-foreground">{item.periodoSunat}</span>
                              {isCurrent && (
                                <Badge className="text-[9px] bg-emerald-600 text-white h-4 px-1">Activo</Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground block">{item.monthLabel}</span>
                          </td>

                          <td className="px-3 py-3 font-mono">
                            <span className="font-bold text-foreground block">{formatPEN(item.totalPurchasesPen)}</span>
                            <span className="text-[10px] text-muted-foreground">{formatUSD(item.totalPurchasesUsd)}</span>
                          </td>

                          <td className="px-3 py-3">
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {item.purchasesCount} uds
                            </Badge>
                          </td>

                          {/* Fabio */}
                          <td className="px-3 py-3 bg-blue-50/30 dark:bg-blue-950/10">
                            <div className="space-y-0.5">
                              <span className="text-muted-foreground block text-[10px]">
                                C: <strong className="text-foreground font-mono">{formatPEN(item.fabio.purchasesPen)}</strong> ({item.fabio.purchasesCount})
                              </span>
                              <span className="text-blue-700 dark:text-blue-400 block text-[10px]">
                                V: <strong className="font-mono">{formatPEN(item.fabio.salesPen)}</strong>
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3 bg-blue-50/30 dark:bg-blue-950/10">
                            <div>
                              <span className="font-bold font-mono text-foreground block">S/ {item.fabio.quota}.00</span>
                              <span className="text-[10px] text-muted-foreground block">{item.fabio.deadlineFormatted}</span>
                              <span className={`text-[10px] font-semibold ${item.fabio.isOverdue ? 'text-muted-foreground' : 'text-emerald-600'}`}>
                                {item.fabio.status}
                              </span>
                            </div>
                          </td>

                          {/* Peggy */}
                          <td className="px-3 py-3 bg-purple-50/30 dark:bg-purple-950/10">
                            <div className="space-y-0.5">
                              <span className="text-muted-foreground block text-[10px]">
                                C: <strong className="text-foreground font-mono">{formatPEN(item.peggy.purchasesPen)}</strong> ({item.peggy.purchasesCount})
                              </span>
                              <span className="text-purple-700 dark:text-purple-400 block text-[10px]">
                                V: <strong className="font-mono">{formatPEN(item.peggy.salesPen)}</strong>
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3 bg-purple-50/30 dark:bg-purple-950/10">
                            <div>
                              <span className="font-bold font-mono text-foreground block">S/ {item.peggy.quota}.00</span>
                              <span className="text-[10px] text-muted-foreground block">{item.peggy.deadlineFormatted}</span>
                              <span className={`text-[10px] font-semibold ${item.peggy.isOverdue ? 'text-muted-foreground' : 'text-emerald-600'}`}>
                                {item.peggy.status}
                              </span>
                            </div>
                          </td>

                          {/* Total Cuota */}
                          <td className="px-3 py-3 text-right font-mono">
                            <span className="font-extrabold text-foreground text-sm block">S/ {totalCuota}.00</span>
                            <span className="text-[10px] text-muted-foreground">BCP / SUNAT</span>
                          </td>

                          {/* Action */}
                          <td className="px-3 py-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[11px] h-7 px-2 gap-1"
                              onClick={() => {
                                setSelectedMonth(item.monthKey);
                                loadData(item.monthKey);
                                setActiveTab('fabio');
                              }}
                            >
                              <FileText className="h-3 w-3" />
                              Ver Form. 1611
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 4: CONSOLIDADO GENERAL DEL NEGOCIO                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="consolidado" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Overview Card */}
            <Card className="border-border/60 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-base">Consolidado Mensual de Compras y Ventas</CardTitle>
                </div>
                <CardDescription>
                  Resumen unificado del negocio para el período {status?.periodoSunat}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Compras Totales */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">Compras Totales Acumuladas:</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatPEN(status?.monthlyPurchases || 0)} ({status?.purchasesCount} equipos)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50">
                      <span className="text-muted-foreground block">Fabio César:</span>
                      <span className="font-semibold text-blue-700 dark:text-blue-400 font-mono text-sm">
                        {formatPEN(fabio?.monthlyPurchasesPen || 0)}
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {fabio?.purchasesCount} equipos • {formatUSD(fabio?.monthlyPurchasesUsd || 0)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/50">
                      <span className="text-muted-foreground block">Peggy Liliana:</span>
                      <span className="font-semibold text-purple-700 dark:text-purple-400 font-mono text-sm">
                        {formatPEN(peggy?.monthlyPurchasesPen || 0)}
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
                        {peggy?.purchasesCount} equipos • {formatUSD(peggy?.monthlyPurchasesUsd || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Estrategia de Balance Bi-RUC */}
                <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <ArrowRightLeft className="h-4 w-4 text-emerald-600" />
                    <span>Estrategia de Optimización Fiscal</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Al operar con <strong>2 RUCs en NRUS</strong> (Fabio y Peggy), tu capacidad mensual de importación combinada en Categoría 1 es de <strong>S/ 10,000.00</strong> pagando únicamente <strong>S/ 40.00</strong> de impuesto total (S/ 20 por cada uno), o hasta <strong>S/ 16,000.00</strong> en Categoría 2 pagando <strong>S/ 100.00</strong>.
                  </p>
                  {peggy && peggy.monthlyPurchasesPen > 8000 && (
                    <div className="flex items-start gap-2 p-2.5 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 mt-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Recomendación Activa:</strong> El RUC de Peggy ha alcanzado los {formatPEN(peggy.monthlyPurchasesPen)}. Tus próximas compras en eBay deben registrarse con la cuenta de <strong>Fabio César</strong> para no tributar en régimen general.
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Guía Summary */}
            <Card className="border-border/60 shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-base">Resumen de Cuotas a Pagar SUNAT</CardTitle>
                </div>
                <CardDescription>
                  Vencimiento según el último dígito del RUC en el cronograma oficial de SUNAT
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="divide-y divide-border/60">
                  {/* Fabio Row */}
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-foreground">Fabio César Herrera Bonilla</p>
                      <p className="text-xs font-mono text-muted-foreground">RUC: 10762026835 (Dígito 5)</p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Vence: {fabio?.guiaPagoFacil.fechaVencimiento || '19 del mes siguiente'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                        {fabio?.category || 'Cat 1'}
                      </Badge>
                      <p className="text-base font-bold text-foreground font-mono mt-0.5">
                        Cuota: S/ {fabio?.monthlyQuotaPen || 20}.00
                      </p>
                    </div>
                  </div>

                  {/* Peggy Row */}
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-foreground">Peggy Liliana Bonilla Orduña</p>
                      <p className="text-xs font-mono text-muted-foreground">RUC: 10091870911 (Dígito 1)</p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Vence: {peggy?.guiaPagoFacil.fechaVencimiento || '15 del mes siguiente'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className={peggy?.category === 'Excedido' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300'}>
                        {peggy?.category || 'Cat 1'}
                      </Badge>
                      <p className="text-base font-bold text-foreground font-mono mt-0.5">
                        Cuota: S/ {peggy?.monthlyQuotaPen || 20}.00
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 text-xs flex items-center justify-between">
                  <span className="font-medium text-emerald-900 dark:text-emerald-300">Total Impuesto Mensual Negocio:</span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                    S/ {((fabio?.monthlyQuotaPen || 0) + (peggy?.monthlyQuotaPen || 0))}.00
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 5: CONFIGURACIÓN DE UMBRALES Y TASAS                        */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="config" className="space-y-4">
          <Card className="border-border/60 shadow-xs max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-emerald-600" />
                <CardTitle className="text-base">Parámetros Tributarios y Aduaneros SUNAT</CardTitle>
              </div>
              <CardDescription>
                Ajusta los umbrales de facturación del NRUS y tasas arancelarias para importaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tope Mensual Categoría 1 (PEN)</Label>
                  <Input
                    type="number"
                    value={cat1Limit}
                    onChange={(e) => setCat1Limit(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">Cuota fija SUNAT: S/ 20</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Tope Mensual Categoría 2 (PEN)</Label>
                  <Input
                    type="number"
                    value={cat2Limit}
                    onChange={(e) => setCat2Limit(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">Cuota fija SUNAT: S/ 50</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">IGV Aduanero Courier (%)</Label>
                  <Input
                    type="number"
                    value={igvRate}
                    onChange={(e) => setIgvRate(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">18% aplicable si FOB &gt; $200 USD</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Ad/Valorem Arancelario (%)</Label>
                  <Input
                    type="number"
                    value={adValoremRate}
                    onChange={(e) => setAdValoremRate(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-[11px] text-muted-foreground">4% tasa estándar courier</p>
                </div>
              </div>

              <Button
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white min-h-[40px]"
              >
                {saving ? 'Guardando...' : 'Guardar Umbrales Tributarios'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── SUBCOMPONENT: Profile NRUS Section with Formulario 1611 Simulator ──
interface ProfileNRUSSectionProps {
  profile: NRUSProfileStatus;
  cat1Limit: number;
  cat2Limit: number;
  onCopyGuia: () => void;
  onCopyField: (label: string, value: string) => void;
  onSaveSales: (sales: number) => Promise<void>;
  isSavingSales: boolean;
  copied: boolean;
}

function ProfileNRUSSection({
  profile,
  cat1Limit,
  cat2Limit,
  onCopyGuia,
  onCopyField,
  onSaveSales,
  isSavingSales,
  copied,
}: ProfileNRUSSectionProps) {
  const maxAmount = profile.maxAmountPen;
  const cat2Pct = Math.min((maxAmount / cat2Limit) * 100, 100);

  const isExceeded = profile.category === 'Excedido';
  const isCat2 = profile.category === 'Cat 2';

  // State for Casilla 507 editing
  const [salesInput, setSalesInput] = useState<string>(
    profile.guiaPagoFacil.ingresosBrutosPen.toString()
  );
  // State for Casilla 509 (Compensación Percepciones IGV)
  const [percepcionInput, setPercepcionInput] = useState<string>(
    (profile.guiaPagoFacil.compensacionPercepcionesPen || 0).toString()
  );

  // Sync when profile changes
  useEffect(() => {
    setSalesInput(profile.guiaPagoFacil.ingresosBrutosPen.toString());
  }, [profile.guiaPagoFacil.ingresosBrutosPen]);

  const parsedSales = parseFloat(salesInput) || 0;
  const parsedPercepcion = parseFloat(percepcionInput) || 0;
  const purchasesPen = profile.guiaPagoFacil.adquisicionesPen;

  // Real-time recalculation of Category & Quota based on local edits
  const currentMax = Math.max(purchasesPen, parsedSales);
  let computedCategory = 'Cat 1';
  let computedQuota = 20;
  if (currentMax > cat2Limit) {
    computedCategory = 'Excedido';
    computedQuota = 50;
  } else if (currentMax > cat1Limit) {
    computedCategory = 'Cat 2';
    computedQuota = 50;
  }

  const computedImportePagar = Math.max(
    computedQuota + (profile.guiaPagoFacil.interesMoratorioPen || 0) - parsedPercepcion,
    0
  );

  // Suggest Safe Sales: +12% above purchases, capped safely within category
  const handleSuggestSafeSales = () => {
    let suggested = 0;
    if (purchasesPen === 0) {
      suggested = 1500;
    } else {
      suggested = Math.round(purchasesPen * 1.12);
      // Keep within bounds
      if (suggested <= cat1Limit) {
        // Cat 1 safe
      } else if (suggested <= cat2Limit) {
        // Cat 2 safe
      } else {
        suggested = cat2Limit;
      }
    }
    setSalesInput(suggested.toString());
  };

  const handleSaveDeclared = () => {
    onSaveSales(parsedSales);
  };

  return (
    <div className="space-y-6">
      {/* Upper Status & Deadline Banner */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Official SUNAT Deadline */}
        <Card className="border-border/60 shadow-xs bg-gradient-to-br from-card to-muted/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-emerald-600" />
                Fecha Límite de Declaración
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ${
                  profile.guiaPagoFacil.estadoPlazo === 'VENCIDO'
                    ? 'bg-red-50 text-red-700 border-red-300'
                    : profile.guiaPagoFacil.estadoPlazo === 'VENCE_PRONTO' || profile.guiaPagoFacil.estadoPlazo === 'VENCE_HOY'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                }`}
              >
                {profile.guiaPagoFacil.estadoPlazo === 'VENCIDO'
                  ? 'Vencido'
                  : profile.guiaPagoFacil.diasRestantes !== undefined && profile.guiaPagoFacil.diasRestantes >= 0
                  ? `Faltan ${profile.guiaPagoFacil.diasRestantes} días`
                  : 'Dentro de plazo'}
              </Badge>
            </div>
            <p className="text-base font-bold text-foreground">
              {profile.guiaPagoFacil.fechaVencimiento || 'Según calendario SUNAT'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Último dígito del RUC: <strong className="text-foreground">{profile.ruc.slice(-1)}</strong> (Cronograma Oficial)
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Categoría & Cuota Determinada */}
        <Card className="border-border/60 shadow-xs bg-gradient-to-br from-card to-muted/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Categoría y Cuota SUNAT
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ${
                  computedCategory === 'Cat 1'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : computedCategory === 'Cat 2'
                    ? 'bg-amber-50 text-amber-700 border-amber-300'
                    : 'bg-red-50 text-red-700 border-red-300'
                }`}
              >
                {computedCategory}
              </Badge>
            </div>
            <p className="text-xl font-extrabold text-foreground font-mono">
              S/ {computedQuota}.00 PEN
            </p>
            <p className="text-[11px] text-muted-foreground">
              Determinada por: <strong className="text-foreground font-mono">{formatPEN(currentMax)}</strong> (Mayor entre C y V)
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Capacidad de Compra Restante */}
        <Card className="border-border/60 shadow-xs bg-gradient-to-br from-card to-muted/20 sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-purple-600" />
                Cupo Disponible RUS (Tope S/ 8,000)
              </span>
              <span className="text-xs font-bold text-emerald-600">
                {Math.max(0, 100 - cat2Pct).toFixed(0)}% libre
              </span>
            </div>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {formatPEN(profile.availablePurchasesPen || 0)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Equivalente a <strong className="text-foreground font-mono">{formatUSD(profile.availablePurchasesUsd || 0)}</strong> de compras eBay
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SUNAT FORMULARIO VIRTUAL Nº 1611 - NUEVO RUS (SIMULADOR REAL)   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Card className="border-2 border-neutral-300 dark:border-neutral-700 shadow-md overflow-hidden bg-card">
        {/* Grey Header Banner identical to SUNAT portal */}
        <div className="bg-[#787f87] text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm sm:text-base tracking-wide">
              Formulario Virtual Nº 1611 - NUEVO RUS
            </h3>
            <HelpCircle className="h-4 w-4 text-white/80 cursor-pointer hover:text-white" />
          </div>

          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="hidden sm:inline text-white/90">Contribuyente:</span>
            <span className="bg-white/20 px-2.5 py-0.5 rounded font-mono text-[11px] text-white">
              {profile.name} (RUC: {profile.ruc})
            </span>
          </div>
        </div>

        {/* Form Body */}
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {/* Row 1: Período Tributario (Casilla 007) */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5 sm:w-1/3">
                <span>Período Tributario:</span>
              </label>

              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                <div className="w-14 text-center py-1 px-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-mono font-bold text-muted-foreground">
                  007
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <Input
                    readOnly
                    value={profile.guiaPagoFacil.periodo}
                    className="h-8 text-xs font-mono font-bold bg-neutral-100 dark:bg-neutral-800/80 cursor-default"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Copiar Período Tributario"
                    onClick={() => onCopyField('Período Tributario (007)', profile.guiaPagoFacil.periodo)}
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 2: ¿Es una declaración rectificatoria? */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5 sm:w-1/3">
                <span>¿Es una declaración rectificatoria?:</span>
              </label>

              <div className="flex items-center gap-6 flex-1 sm:justify-start sm:pl-16">
                <label className="flex items-center gap-2 text-xs cursor-not-allowed opacity-50">
                  <input type="radio" name={`rect-${profile.importerKey}`} disabled />
                  <span>Sí</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-default">
                  <input type="radio" name={`rect-${profile.importerKey}`} defaultChecked readOnly />
                  <span>No</span>
                </label>
              </div>
            </div>

            {/* Row 3: Total de ingresos brutos (Casilla 507) */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50/20 dark:bg-blue-950/10 rounded-lg p-2">
              <div className="sm:w-1/3">
                <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <span>Total de ingresos brutos:</span>
                </label>
                <span className="text-[11px] text-muted-foreground block">
                  Ventas mensuales declarables
                </span>
              </div>

              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                <div className="w-14 text-center py-1 px-2 bg-blue-100 dark:bg-blue-900/60 border border-blue-300 dark:border-blue-700 rounded text-xs font-mono font-bold text-blue-900 dark:text-blue-200">
                  507
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-mono">S/</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={salesInput}
                      onChange={(e) => setSalesInput(e.target.value)}
                      className="h-8 pl-8 text-xs font-mono font-bold bg-background border-blue-400 focus-visible:ring-blue-500"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Copiar Casilla 507"
                    onClick={() => onCopyField('Casilla 507 (Ingresos Brutos)', parsedSales.toFixed(0))}
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Sub-row for Casilla 507 Actions: Sugerir Ventas Seguras & Guardar */}
            <div className="py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs bg-muted/20 px-2 rounded">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestSafeSales}
                  className="h-7 text-[11px] gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                >
                  <Sparkles className="h-3 w-3" />
                  Sugerir Ventas Seguras (+12% sobre compras)
                </Button>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  (Evita observaciones de SUNAT)
                </span>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={handleSaveDeclared}
                disabled={isSavingSales}
                className="h-7 text-[11px] gap-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="h-3 w-3" />
                {isSavingSales ? 'Guardando...' : 'Guardar Casilla 507'}
              </Button>
            </div>

            {/* Row 4: Total de adquisiciones o compras (Casilla 607) */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="sm:w-1/3">
                <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <span>Total de adquisiciones o compras:</span>
                </label>
                <span className="text-[11px] text-muted-foreground block">
                  {profile.purchasesCount} equipos importados ({formatUSD(profile.monthlyPurchasesUsd)} @ S/ 3.40)
                </span>
              </div>

              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                <div className="w-14 text-center py-1 px-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-mono font-bold text-muted-foreground">
                  607
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <Input
                    readOnly
                    value={`S/ ${purchasesPen.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    className="h-8 text-xs font-mono font-bold bg-neutral-100 dark:bg-neutral-800/80 cursor-default"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Copiar Casilla 607"
                    onClick={() => onCopyField('Casilla 607 (Compras)', Math.round(purchasesPen).toString())}
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 5: Categoría (Casilla 400) */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5 sm:w-1/3">
                <span>Categoría:</span>
              </label>

              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                <div className="w-14 text-center py-1 px-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-mono font-bold text-muted-foreground">
                  400
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <div className="h-8 px-3 py-1 bg-neutral-100 dark:bg-neutral-800/80 border rounded-md text-xs font-semibold flex items-center justify-between flex-1">
                    <span>
                      {computedCategory === 'Cat 1'
                        ? 'Categoría 1 (Hasta S/ 5,000)'
                        : computedCategory === 'Cat 2'
                        ? 'Categoría 2 (Hasta S/ 8,000)'
                        : '¡Supera Tope S/ 8,000!'}
                    </span>
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {computedCategory}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Copiar Categoría"
                    onClick={() => onCopyField('Casilla 400 (Categoría)', computedCategory === 'Cat 1' ? '1' : '2')}
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 6: Monto de cuota mensual (Casilla 503) */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5 sm:w-1/3">
                <span>Monto de cuota mensual:</span>
              </label>

              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                <div className="w-14 text-center py-1 px-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-mono font-bold text-muted-foreground">
                  503
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <Input
                    readOnly
                    value={`S/ ${computedQuota}.00`}
                    className="h-8 text-xs font-mono font-bold bg-neutral-100 dark:bg-neutral-800/80 cursor-default"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Copiar Casilla 503"
                    onClick={() => onCopyField('Casilla 503 (Cuota)', computedQuota.toString())}
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 7: Interés moratorio (Casilla 504) */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="sm:w-1/3">
                <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <span>Interés moratorio:</span>
                </label>
                <span className="text-[11px] text-muted-foreground block">
                  {profile.guiaPagoFacil.estadoPlazo === 'VENCIDO' ? 'Cálculo de mora SUNAT aplicada' : 'S/ 0.00 dentro de fecha'}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                <div className="w-14 text-center py-1 px-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-mono font-bold text-muted-foreground">
                  504
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <Input
                    readOnly
                    value={`S/ ${profile.guiaPagoFacil.interesMoratorioPen || 0}.00`}
                    className="h-8 text-xs font-mono font-bold bg-neutral-100 dark:bg-neutral-800/80 cursor-default"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Copiar Casilla 504"
                    onClick={() => onCopyField('Casilla 504 (Interés)', (profile.guiaPagoFacil.interesMoratorioPen || 0).toString())}
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 8: Compensación de las percepciones del IGV (Casilla 509) */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="sm:w-1/3">
                <label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <span>Compensación de las percepciones del IGV:</span>
                </label>
                <span className="text-[11px] text-muted-foreground block">
                  Crédito por percepción aduanera pagada
                </span>
              </div>

              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                <div className="w-14 text-center py-1 px-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded text-xs font-mono font-bold text-muted-foreground">
                  509
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-mono">S/</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={percepcionInput}
                      onChange={(e) => setPercepcionInput(e.target.value)}
                      className="h-8 pl-8 text-xs font-mono font-bold bg-background"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Copiar Casilla 509"
                    onClick={() => onCopyField('Casilla 509 (Percepciones)', parsedPercepcion.toString())}
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 9: Importe a pagar (Casilla 505) */}
            <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-lg p-2.5">
              <label className="text-sm font-bold text-foreground flex items-center gap-1.5 sm:w-1/3">
                <span>Importe a pagar:</span>
              </label>

              <div className="flex items-center gap-2 flex-1 sm:justify-end">
                <div className="w-14 text-center py-1 px-2 bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 rounded text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-200">
                  505
                </div>
                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <Input
                    readOnly
                    value={`S/ ${computedImportePagar}.00`}
                    className="h-9 text-sm font-mono font-extrabold text-emerald-700 dark:text-emerald-300 bg-neutral-100 dark:bg-neutral-800 cursor-default"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Copiar Casilla 505"
                    onClick={() => onCopyField('Casilla 505 (Importe a Pagar)', computedImportePagar.toString())}
                  >
                    <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions Footer (Maroon button identical to SUNAT) */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-4 w-4 text-emerald-600" />
              <span>
                Vencimiento Oficial SUNAT: <strong>{profile.guiaPagoFacil.fechaVencimiento}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Maroon Button '+ Agregar a bandeja' / 'Copiar Formulario' */}
              <Button
                type="button"
                onClick={onCopyGuia}
                className="flex-1 sm:flex-initial gap-2 bg-[#8b0032] hover:bg-[#720029] text-white font-semibold text-xs h-10 px-5 shadow-xs"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                {copied ? '¡Casillas Copiadas!' : '+ Copiar Casillas para SUNAT'}
              </Button>

              <a
                href="https://e-menu.sunat.gob.pe/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-3.5 h-10 hover:bg-muted transition-colors whitespace-nowrap"
              >
                <span>Ir a SUNAT Virtual</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
