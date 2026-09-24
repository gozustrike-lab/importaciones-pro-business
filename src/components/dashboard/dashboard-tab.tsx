'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Wallet,
  PackageCheck,
  Database,
  AlertTriangle,
  Users,
  ShoppingCart,
  Ticket,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Plane,
  Truck,
  Building2,
  Clock,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { fetchDashboardStats, seedData } from '@/lib/api';
import type { DashboardStats, Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUSD(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, string> = {
  TRANSITO_USA: 'bg-sky-500',
  USA: 'bg-emerald-500',
  'En Tránsito': 'bg-amber-500',
  Perú: 'bg-purple-500',
  Entregado: 'bg-purple-500',
  Vendido: 'bg-zinc-500',
};

function getStatusBadge(status: string) {
  if (status === 'TRANSITO_USA') {
    return (
      <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300">
        🚚 Tránsito USA
      </Badge>
    );
  }
  if (status === 'USA') {
    return (
      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
        🏢 En Miami
      </Badge>
    );
  }
  if (status === 'En Tránsito') {
    return (
      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
        ✈️ En Vuelo
      </Badge>
    );
  }
  if (status === 'Perú' || status === 'Entregado') {
    return (
      <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300">
        🇵🇪 En Lima
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}

const purchasesChartConfig: ChartConfig = {
  investedPen: { label: 'Inversión (PEN)', color: '#10b981' },
  count: { label: 'Equipos Comprados', color: '#3b82f6' },
};

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

type TimeframeOption = 'today' | 'thisWeek' | 'thisMonth' | 'total';

export function DashboardTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframeOption>('thisMonth');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await fetchDashboardStats();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleCopy = (text: string, id: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
    toast({ title: `${label} copiado`, description: text });
  };

  const handleSeed = async () => {
    try {
      setSeeding(true);
      await seedData();
      toast({ title: 'Datos cargados', description: 'Se cargaron los datos de ejemplo correctamente.' });
      await loadStats();
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los datos de ejemplo.', variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  // Get active purchase stats based on timeframe selector
  const activePurchaseStats = useMemo(() => {
    if (!stats?.purchases) return { count: 0, investedUsd: 0, investedPen: 0 };
    switch (timeframe) {
      case 'today':
        return stats.purchases.today;
      case 'thisWeek':
        return stats.purchases.thisWeek;
      case 'thisMonth':
        return stats.purchases.thisMonth;
      case 'total':
      default:
        return stats.purchases.total;
    }
  }, [stats, timeframe]);

  const timeframeLabels: Record<TimeframeOption, string> = {
    today: 'Hoy (24h)',
    thisWeek: 'Esta Semana',
    thisMonth: 'Este Mes (Set)',
    total: 'Histórico Total',
  };

  const pieData = useMemo(() => {
    if (!stats?.purchases?.byImporter) return [];
    return [
      { name: 'Fabio (10762026835)', value: stats.purchases.byImporter.fabio.investedPen, count: stats.purchases.byImporter.fabio.count },
      { name: 'Peggy (10091870911)', value: stats.purchases.byImporter.peggy.investedPen, count: stats.purchases.byImporter.peggy.count },
    ];
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Panel General</h2>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400">
              Control Ejecutivo
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión completa de compras eBay, logística internacional y ventas en Perú
          </p>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border/60 self-start sm:self-auto overflow-x-auto max-w-full">
          {(['today', 'thisWeek', 'thisMonth', 'total'] as TimeframeOption[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                timeframe === tf
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {timeframeLabels[tf]}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SUNAT NRUS PURCHASE LIMIT ALERT & RECOMMENDATION BANNER       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {stats?.nrus?.recommendation && (
        <Card
          className={`border overflow-hidden shadow-sm transition-all ${
            stats.nrus.recommendation.severity === 'critical'
              ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/25'
              : stats.nrus.recommendation.severity === 'warning'
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/25'
              : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
          }`}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    stats.nrus.recommendation.severity === 'critical'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                      : stats.nrus.recommendation.severity === 'warning'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-foreground">
                      {stats.nrus.recommendation.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold ${
                        stats.nrus.recommendation.severity === 'critical'
                          ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300'
                          : stats.nrus.recommendation.severity === 'warning'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      Límite RUS: S/ 8,000 / mes
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {stats.nrus.recommendation.description}
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground pt-0.5">
                    👉 {stats.nrus.recommendation.actionBanner}
                  </p>
                </div>
              </div>

              {/* Quick Status Pill for Fabio & Peggy */}
              <div className="grid grid-cols-2 lg:flex lg:flex-row gap-2.5 shrink-0 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-border/50">
                <div className="p-3 rounded-lg bg-background/90 border border-border/60 text-xs min-w-[170px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-blue-700 dark:text-blue-400">RUC Fabio (10762026835)</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 dark:bg-blue-950/40 text-blue-700">
                      {stats.nrus.recommendation.fabioConsumedPct}%
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Disponible: <strong className="text-emerald-700 dark:text-emerald-400">S/ {stats.nrus.recommendation.fabioAvailablePen.toFixed(2)}</strong> (${stats.nrus.recommendation.fabioAvailableUsd.toFixed(2)} USD)
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-background/90 border border-border/60 text-xs min-w-[170px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-purple-700 dark:text-purple-400">RUC Peggy (10091870911)</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${
                        stats.nrus.recommendation.peggyConsumedPct > 100
                          ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400'
                          : 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-400'
                      }`}
                    >
                      {stats.nrus.recommendation.peggyConsumedPct}%
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {stats.nrus.recommendation.peggyAvailablePen < 0 ? (
                      <strong className="text-red-600 dark:text-red-400">Excedido: -S/ {Math.abs(stats.nrus.recommendation.peggyAvailablePen).toFixed(2)}</strong>
                    ) : (
                      <>Disponible: <strong className="text-foreground">S/ {stats.nrus.recommendation.peggyAvailablePen.toFixed(2)}</strong></>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EXECUTIVE KPI CARDS (Responsive: 1 col mob, 2 tab, 4 desk)     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Inversión en Compras eBay */}
        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Compras eBay ({timeframeLabels[timeframe]})
              </span>
              <Badge variant="secondary" className="text-[11px] font-mono font-medium">
                {activePurchaseStats.count} {activePurchaseStats.count === 1 ? 'equipo' : 'equipos'}
              </Badge>
            </div>

            <div className="space-y-0.5">
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatUSD(activePurchaseStats.investedUsd)}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatPEN(activePurchaseStats.investedPen)}
                </span>
                <span className="text-[11px]">T.C. S/ 3.40</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Control Bi-RUC SUNAT (Acumulado Mes) */}
        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Inversión Bi-RUC SUNAT
              </span>
              <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                Tope $2,000 / $200
              </Badge>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fabio (10762026835):</span>
                <span className="font-semibold text-foreground font-mono">
                  {formatUSD(stats?.purchases?.byImporter.fabio.investedUsd || 0)} ({stats?.purchases?.byImporter.fabio.count || 0} u.)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Peggy (10091870911):</span>
                <span className="font-semibold text-foreground font-mono">
                  {formatUSD(stats?.purchases?.byImporter.peggy.investedUsd || 0)} ({stats?.purchases?.byImporter.peggy.count || 0} u.)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Estado Logístico de Importaciones */}
        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Flujo Logístico Shipper
              </span>
              <span className="text-xs font-semibold text-foreground">
                {stats?.activeProducts || 0} en tránsito
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1 pt-1 text-center">
              <div className="p-1 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200/50 dark:border-sky-900/50">
                <span className="text-base font-bold text-sky-700 dark:text-sky-400 block leading-tight">
                  {stats?.productsByStatus.TRANSITO_USA || 0}
                </span>
                <span className="text-[9px] text-muted-foreground block truncate">Tránsito</span>
              </div>
              <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-900/50">
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-400 block leading-tight">
                  {stats?.productsByStatus.USA || 0}
                </span>
                <span className="text-[9px] text-muted-foreground block truncate">En Miami</span>
              </div>
              <div className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/50">
                <span className="text-base font-bold text-amber-700 dark:text-amber-400 block leading-tight">
                  {stats?.productsByStatus['En Tránsito'] || 0}
                </span>
                <span className="text-[9px] text-muted-foreground block truncate">En Vuelo</span>
              </div>
              <div className="p-1 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-900/50">
                <span className="text-base font-bold text-purple-700 dark:text-purple-400 block leading-tight">
                  {(stats?.productsByStatus.Perú || 0) + (stats?.productsByStatus.Entregado || 0)}
                </span>
                <span className="text-[9px] text-muted-foreground block truncate">En Lima</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Ventas & Margen Comercial */}
        <Card className="border-border/60 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                Ventas & Utilidad
              </span>
              <Badge variant="outline" className="text-[10px]">
                {stats?.totalSales || 0} ventas
              </Badge>
            </div>

            <div className="space-y-0.5">
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatPEN(stats?.totalRevenue || 0)}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Ganancia Neta:</span>
                <span className={`font-semibold ${stats && stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatPEN(stats?.netProfit || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CHARTS SECTION: TIMELINE PURCHASES + RUC DISTRIBUTION           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {stats?.purchases?.timeline && (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          {/* Timeline Chart (2 cols) */}
          <Card className="lg:col-span-2 border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Evolución de Compras e Inversión</CardTitle>
                  <CardDescription>Actividad de compras en eBay de los últimos 14 días</CardDescription>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span>Inversión (S/)</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.purchases.timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/40" />
                    <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `S/${v}`} />
                    <Tooltip
                      formatter={(val: any, name: any) => {
                        if (name === 'investedPen') return [`S/ ${val}`, 'Inversión'];
                        if (name === 'count') return [`${val} u.`, 'Equipos'];
                        return [val, name];
                      }}
                      contentStyle={{
                        backgroundColor: 'var(--background)',
                        borderColor: 'var(--border)',
                        borderRadius: '0.5rem',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="investedPen" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Bi-RUC Distribution Chart (1 col) */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Distribución por Titular RUC</CardTitle>
              <CardDescription>Proporción de inversión Fabio vs Peggy</CardDescription>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <div className="space-y-4">
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          innerRadius={45}
                          strokeWidth={2}
                        >
                          {pieData.map((_, index) => (
                            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any) => [`S/ ${v.toLocaleString('es-PE')}`, 'Inversión']}
                          contentStyle={{
                            backgroundColor: 'var(--background)',
                            borderColor: 'var(--border)',
                            borderRadius: '0.5rem',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 pt-1 border-t border-border/50 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <span className="font-medium">Fabio César</span>
                      </div>
                      <span className="font-mono text-muted-foreground font-semibold">
                        {formatPEN(stats.purchases.byImporter.fabio.investedPen)} ({stats.purchases.byImporter.fabio.count} u.)
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                        <span className="font-medium">Peggy Liliana</span>
                      </div>
                      <span className="font-mono text-muted-foreground font-semibold">
                        {formatPEN(stats.purchases.byImporter.peggy.investedPen)} ({stats.purchases.byImporter.peggy.count} u.)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground text-sm">
                  Sin datos de compras
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* RECENT PURCHASES (Mobile Cards + Desktop Table)                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {stats?.recentProducts && stats.recentProducts.length > 0 && (
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Últimas Compras en eBay</CardTitle>
                <CardDescription>Compras reales sincronizadas directamente desde tu cuenta</CardDescription>
              </div>
              {onNavigate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigate('productos')}
                  className="gap-1.5 text-xs h-8"
                >
                  Ver inventario completo
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[45%]">Producto / Compra eBay</TableHead>
                    <TableHead className="w-[20%]">Tracking & Courier</TableHead>
                    <TableHead className="w-[15%]">Titular SUNAT</TableHead>
                    <TableHead className="w-[10%]">Estado</TableHead>
                    <TableHead className="w-[10%] text-right">Costo USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentProducts.map((p) => {
                    const isPeggy = (p.importerProfile || '').toLowerCase() === 'peggy';
                    const ebayUrl =
                      p.itemUrl ||
                      (p.itemId ? `https://www.ebay.com/itm/${p.itemId}` : null) ||
                      (p.orderNumber ? `https://order.ebay.com/ord/show?orderId=${p.orderNumber}` : null);

                    return (
                      <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="py-2.5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground line-clamp-1 max-w-[320px]" title={p.description}>
                                {p.description}
                              </span>
                              {ebayUrl && (
                                <a
                                  href={ebayUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-orange-600 hover:text-orange-700 shrink-0"
                                  title="Ver en eBay"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                              <span>{p.orderNumber || '-'}</span>
                              <span>•</span>
                              <span>{p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString('es-PE') : '-'}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="py-2.5">
                          <div className="space-y-0.5 text-xs font-mono">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {p.courier || 'USPS'}
                            </Badge>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                              {p.trackingNumber || 'Sin tracking'}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="py-2.5">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${
                              isPeggy
                                ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                            }`}
                          >
                            {isPeggy ? 'Peggy' : 'Fabio'}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-2.5">
                          {getStatusBadge(p.status)}
                        </TableCell>

                        <TableCell className="py-2.5 text-right font-bold text-xs">
                          ${p.purchasePriceUSD.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="block md:hidden divide-y divide-border/50">
              {stats.recentProducts.map((p) => {
                const isPeggy = (p.importerProfile || '').toLowerCase() === 'peggy';
                const ebayUrl =
                  p.itemUrl ||
                  (p.itemId ? `https://www.ebay.com/itm/${p.itemId}` : null) ||
                  (p.orderNumber ? `https://order.ebay.com/ord/show?orderId=${p.orderNumber}` : null);

                return (
                  <div key={p.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            isPeggy
                              ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                          }`}
                        >
                          {isPeggy ? 'Peggy' : 'Fabio'}
                        </Badge>
                        {getStatusBadge(p.status)}
                      </div>

                      {ebayUrl && (
                        <a
                          href={ebayUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600"
                        >
                          <ExternalLink className="h-3 w-3" />
                          eBay
                        </a>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug">
                      {p.description}
                    </p>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {p.courier} • {p.trackingNumber || 'Sin tracking'}
                      </span>
                      <span className="font-bold text-foreground">
                        ${p.purchasePriceUSD.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SUNAT NRUS ALERT CARD                                           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {stats?.nrus && (
        <Card className="border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">Alerta Fiscal SUNAT (NRUS)</CardTitle>
            </div>
            <CardDescription>
              Monitorea tus ventas mensuales para no exceder los límites del Nuevo Régimen Único Simplificado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ventas declaradas del mes:</span>
              <span className="font-semibold text-foreground">
                S/ {(stats.nrus.totalMonthlySalesPen ?? stats.nrus.monthlySales ?? 0).toLocaleString('es-PE', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <Progress value={Math.min(((stats.nrus.totalMonthlySalesPen ?? stats.nrus.monthlySales ?? 0) / 8000) * 100, 100)} className="h-2.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Límite Categoría 2: S/ 8,000</span>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400">
                {stats.nrus.category || 'Cat 1'}: {(stats.nrus.percentageOfThreshold ?? 0).toFixed(0)}% del límite
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
