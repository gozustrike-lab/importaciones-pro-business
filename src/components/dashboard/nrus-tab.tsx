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
  Printer,
  ChevronRight,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Sparkles,
  Info,
  Settings,
  ArrowRightLeft,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { fetchNRUSStatus, fetchNRUSConfig, updateNRUSConfig } from '@/lib/api';
import type { NRUSStatus, NRUSConfig, NRUSProfileStatus } from '@/lib/types';
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
  const [activeTab, setActiveTab] = useState<'fabio' | 'peggy' | 'consolidado' | 'config'>('fabio');
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Editable config form
  const [cat1Limit, setCat1Limit] = useState('5000');
  const [cat2Limit, setCat2Limit] = useState('8000');
  const [igvRate, setIgvRate] = useState('18');
  const [adValoremRate, setAdValoremRate] = useState('4');
  const [percepcionRate, setPercepcionRate] = useState('10');

  const loadData = useCallback(async (month?: string) => {
    try {
      setLoading(true);
      const [s, c] = await Promise.all([
        fetchNRUSStatus(month || selectedMonth),
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
Titular: ${profile.name}
RUC: ${profile.ruc}
Período Tributario: ${profile.guiaPagoFacil.periodo}
¿Es declaración rectificatoria?: NO
Total Ingresos Brutos (Ventas): S/ ${profile.guiaPagoFacil.ingresosBrutosPen.toLocaleString('es-PE')}
Total Adquisiciones (Compras): S/ ${profile.guiaPagoFacil.adquisicionesPen.toLocaleString('es-PE')}
Categoría Determinada: ${profile.guiaPagoFacil.categoria}
Importe a Pagar SUNAT: S/ ${profile.guiaPagoFacil.importePagarPen}.00
T.C. Referencial: S/ 3.40`;

    navigator.clipboard.writeText(text);
    setCopiedKey(profile.importerKey);
    setTimeout(() => setCopiedKey(null), 2000);
    toast({
      title: 'Guía Pago Fácil Copiada',
      description: `Datos de pago para ${profile.name} copiados al portapapeles.`,
    });
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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Control Tributario SUNAT — Nuevo RUS</h2>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400">
              Bi-RUC Automático
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cálculo mensual automático de compras eBay vs ventas para emisión de Guía Pago Fácil SUNAT (Form. 1611)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center gap-1.5 bg-card border rounded-lg px-2.5 py-1 text-xs shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Período:</span>
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                loadData(e.target.value);
              }}
              className="bg-transparent font-semibold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="2026-09">Setiembre 2026</option>
              <option value="2026-08">Agosto 2026</option>
              <option value="2026-07">Julio 2026</option>
              <option value="2026-10">Octubre 2026</option>
            </select>
          </div>

          <Badge variant="secondary" className="text-xs px-2.5 py-1">
            T.C. S/ 3.40
          </Badge>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SMART PURCHASE ALERT & RECOMMENDATION BANNER                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {status?.recommendation && (
        <Card
          className={`border overflow-hidden shadow-sm transition-all ${
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
        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                Compras del Mes ({status?.periodoSunat})
              </span>
              <Badge variant="secondary" className="text-[11px] font-mono">
                {status?.purchasesCount || 0} equipos
              </Badge>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatPEN(status?.monthlyPurchases || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatUSD(status?.monthlyPurchasesUsd || 0)} USD acumulado
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Ventas del Mes */}
        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Ventas del Mes ({status?.periodoSunat})
              </span>
              <Badge variant="secondary" className="text-[11px] font-mono">
                {status?.salesCount || 0} ventas
              </Badge>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatPEN(status?.monthlySales || 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ingresos brutos declarables
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Estado RUC Fabio */}
        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600" />
                Fabio (10762026835)
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
                {fabio?.category || 'Cat 1'} • Cuota S/ {fabio?.monthlyQuotaPen || 20}
              </Badge>
            </div>
            <p className="text-xl font-bold tracking-tight text-foreground">
              {formatPEN(fabio?.monthlyPurchasesPen || 0)}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>Tope RUS S/ 8,000</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Disp: {formatPEN(fabio?.availablePurchasesPen || Math.max(8000 - (fabio?.monthlyPurchasesPen || 0), 0))} ({formatUSD(fabio?.availablePurchasesUsd || 0)})
              </span>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Estado RUC Peggy */}
        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-purple-600" />
                Peggy (10091870911)
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
                {peggy?.category || 'Cat 1'} • {peggy?.category === 'Excedido' ? '¡Tope Superado!' : `Cuota S/ ${peggy?.monthlyQuotaPen || 20}`}
              </Badge>
            </div>
            <p className="text-xl font-bold tracking-tight text-foreground">
              {formatPEN(peggy?.monthlyPurchasesPen || 0)}
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>Tope RUS S/ 8,000</span>
              <span className={`font-semibold ${peggy && peggy.monthlyPurchasesPen > 8000 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600'}`}>
                {peggy && peggy.monthlyPurchasesPen > 8000 ? `Exceso: ${formatPEN(peggy.monthlyPurchasesPen - 8000)}` : `Disp: ${formatPEN(peggy?.availablePurchasesPen || 0)}`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="grid grid-cols-4 max-w-xl h-10 p-1">
          <TabsTrigger value="fabio" className="text-xs font-medium gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
            Fabio César
          </TabsTrigger>
          <TabsTrigger value="peggy" className="text-xs font-medium gap-1.5">
            <span className="h-2 w-2 rounded-full bg-purple-500 shrink-0" />
            Peggy Liliana
          </TabsTrigger>
          <TabsTrigger value="consolidado" className="text-xs font-medium gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            Consolidado
          </TabsTrigger>
          <TabsTrigger value="config" className="text-xs font-medium gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Umbrales
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 1: FABIO CESAR (RUC 10762026835)                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="fabio" className="space-y-4">
          {fabio && (
            <ProfileNRUSCard
              profile={fabio}
              cat1Limit={status?.category1Limit || 5000}
              cat2Limit={status?.category2Limit || 8000}
              onCopyGuia={() => handleCopyGuia(fabio)}
              copied={copiedKey === 'fabio'}
            />
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 2: PEGGY LILIANA (RUC 10091870911)                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="peggy" className="space-y-4">
          {peggy && (
            <ProfileNRUSCard
              profile={peggy}
              cat1Limit={status?.category1Limit || 5000}
              cat2Limit={status?.category2Limit || 8000}
              onCopyGuia={() => handleCopyGuia(peggy)}
              copied={copiedKey === 'peggy'}
            />
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB 3: CONSOLIDADO GENERAL DEL NEGOCIO                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="consolidado" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Overview Card */}
            <Card className="border-border/60 shadow-sm">
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
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-base">Resumen de Cuotas a Pagar SUNAT</CardTitle>
                </div>
                <CardDescription>
                  Vencimiento según el último dígito del RUC en el cronograma SUNAT
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="divide-y divide-border/60">
                  {/* Fabio Row */}
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-foreground">Fabio César Herrera Bonilla</p>
                      <p className="text-xs font-mono text-muted-foreground">RUC: 10762026835 (Dígito 5)</p>
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
        {/* TAB 4: CONFIGURACIÓN DE UMBRALES Y TASAS                        */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <TabsContent value="config" className="space-y-4">
          <Card className="border-border/60 shadow-sm max-w-2xl">
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

// ── SUBCOMPONENT: Profile NRUS Card & Guía Pago Fácil ──
interface ProfileNRUSCardProps {
  profile: NRUSProfileStatus;
  cat1Limit: number;
  cat2Limit: number;
  onCopyGuia: () => void;
  copied: boolean;
}

function ProfileNRUSCard({ profile, cat1Limit, cat2Limit, onCopyGuia, copied }: ProfileNRUSCardProps) {
  const maxAmount = profile.maxAmountPen;
  const cat1Pct = Math.min((maxAmount / cat1Limit) * 100, 100);
  const cat2Pct = Math.min((maxAmount / cat2Limit) * 100, 100);

  const isExceeded = profile.category === 'Excedido';
  const isCat2 = profile.category === 'Cat 2';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Status & Limits Card */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              <div>
                <CardTitle className="text-base">{profile.name}</CardTitle>
                <CardDescription className="font-mono text-xs">
                  RUC: {profile.ruc} • NRUS Activo
                </CardDescription>
              </div>
            </div>

            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-0.5 font-bold ${
                isExceeded
                  ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400'
                  : isCat2
                  ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400'
              }`}
            >
              {profile.category} • Cuota S/ {profile.monthlyQuotaPen}.00
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Message */}
          <div
            className={`p-3 rounded-lg text-xs leading-relaxed border ${
              isExceeded
                ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/50'
                : isCat2
                ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50'
            }`}
          >
            <p className="font-medium">{profile.statusMessage}</p>
          </div>

          {/* Compras Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Compras del Mes (Adquisiciones):</span>
              <span className="font-mono font-bold text-foreground">
                {formatPEN(profile.monthlyPurchasesPen)} ({profile.purchasesCount} equipos / {formatUSD(profile.monthlyPurchasesUsd)})
              </span>
            </div>
            <Progress
              value={cat2Pct}
              className={`h-2.5 ${isExceeded ? '[&>div]:bg-red-600' : isCat2 ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-600'}`}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
              <span>0</span>
              <span>Cat 1: S/ 5,000 (S/ 20)</span>
              <span>Tope Cat 2: S/ 8,000 (S/ 50)</span>
            </div>
          </div>

          {/* Ventas Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ventas del Mes (Ingresos Brutos):</span>
              <span className="font-mono font-bold text-foreground">
                {formatPEN(profile.monthlySalesPen)} ({profile.salesCount} ventas)
              </span>
            </div>
            <Progress value={Math.min((profile.monthlySalesPen / cat2Limit) * 100, 100)} className="h-2" />
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
              <span className="text-muted-foreground block">Monto Mayor del Mes:</span>
              <span className="text-base font-bold text-foreground font-mono mt-0.5 block">
                {formatPEN(maxAmount)}
              </span>
              <span className="text-[11px] text-muted-foreground">Base de cálculo SUNAT</span>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs">
              <span className="text-muted-foreground block">Cuota Mensual SUNAT:</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                S/ {profile.monthlyQuotaPen}.00
              </span>
              <span className="text-[11px] text-muted-foreground">A pagar en BCP / SUNAT</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Guía Pago Fácil SUNAT Formulario 1611 */}
      <Card className="border-border/60 shadow-sm relative overflow-hidden bg-gradient-to-b from-card to-muted/20">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              <div>
                <CardTitle className="text-base">Guía Pago Fácil — Nuevo RUS</CardTitle>
                <CardDescription className="text-xs">Formulario Virtual SUNAT 1611</CardDescription>
              </div>
            </div>

            <Button
              onClick={onCopyGuia}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8 bg-card shadow-xs"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '¡Copiado!' : 'Copiar Datos'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="p-4 rounded-xl border border-dashed border-border/80 bg-background/60 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">N° RUC DEL DEUDOR:</span>
              <span className="font-bold text-sm text-foreground">{profile.guiaPagoFacil.ruc}</span>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">PERÍODO TRIBUTARIO:</span>
              <span className="font-bold text-sm text-foreground">{profile.guiaPagoFacil.periodo}</span>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">¿RECTIFICATORIA?:</span>
              <span className="font-semibold text-foreground">NO</span>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">TOTAL INGRESOS BRUTOS:</span>
              <span className="font-bold text-foreground">
                S/ {profile.guiaPagoFacil.ingresosBrutosPen.toLocaleString('es-PE')}
              </span>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">TOTAL ADQUISICIONES:</span>
              <span className="font-bold text-foreground">
                S/ {profile.guiaPagoFacil.adquisicionesPen.toLocaleString('es-PE')}
              </span>
            </div>

            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">CATEGORÍA DETERMINADA:</span>
              <span className="font-bold text-sm text-emerald-600">
                {profile.guiaPagoFacil.categoria}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-foreground font-bold">IMPORTE A PAGAR:</span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                S/ {profile.guiaPagoFacil.importePagarPen}.00
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
            <Button
              onClick={onCopyGuia}
              className="w-full sm:flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[40px]"
            >
              <Copy className="h-4 w-4" />
              Copiar para BCP / App SUNAT
            </Button>
            <a
              href="https://e-menu.sunat.gob.pe/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-md px-3 py-2.5 h-10 hover:bg-muted transition-colors"
            >
              <span>Ir a SUNAT Virtual</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
