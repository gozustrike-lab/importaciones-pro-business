'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Facebook,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { fetchProfitAnalytics, fetchSales } from '@/lib/api';
import type { ProfitAnalytics, Sale } from '@/lib/types';

function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const profitChartConfig: ChartConfig = {
  revenue: { label: 'Ingresos', color: '#10b981' },
  costs: { label: 'Costos', color: '#ef4444' },
  profit: { label: 'Ganancia', color: '#3b82f6' },
};

const marginChartConfig: ChartConfig = {
  margin: { label: 'Margen %', color: '#8b5cf6' },
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

export function AnaliticaTab() {
  const [analytics, setAnalytics] = useState<ProfitAnalytics | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const params = monthFilter !== 'all' ? { month: monthFilter } : {};
        const [analyticsData, salesData] = await Promise.all([
          fetchProfitAnalytics(params),
          fetchSales(),
        ]);
        setAnalytics(analyticsData);
        setSales(salesData);
      } catch {
        setAnalytics(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [monthFilter]);

  // Generate unique months for filter
  const uniqueMonths = Array.from(new Set(sales.map(s => {
    const d = new Date(s.saleDate);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }))).sort().reverse();

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Analítica de Utilidad Real</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics || sales.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Analítica de Utilidad Real</h2>
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">No hay datos de ventas</p>
            <p className="text-sm">Registra ventas para ver la analítica de utilidad</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Top clients by spending
  const clientSpending: Record<string, { name: string; spent: number; purchases: number }> = {};
  for (const s of sales) {
    if (!clientSpending[s.clientId]) {
      clientSpending[s.clientId] = { name: s.clientName, spent: 0, purchases: 0 };
    }
    clientSpending[s.clientId].spent += s.salePricePen;
    clientSpending[s.clientId].purchases += 1;
  }
  const topClients = Object.values(clientSpending).sort((a, b) => b.spent - a.spent).slice(0, 5);

  // Per-sale breakdown
  const recentSalesBreakdown = sales.slice(0, 10).map(s => ({
    id: s.id,
    date: new Date(s.saleDate).toLocaleDateString('es-PE'),
    product: s.productDescription.length > 30 ? s.productDescription.substring(0, 30) + '...' : s.productDescription,
    client: s.clientName,
    revenue: s.salePricePen,
    costAcq: s.costAcquisitionPen,
    costMkt: s.costMarketingPen,
    costOps: s.costOperativePen,
    totalCost: s.costAcquisitionPen + s.costMarketingPen + s.costOperativePen,
    profit: s.netProfitPen,
    margin: s.profitMargin,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analítica de Utilidad Real</h2>
          <p className="text-muted-foreground">Motor de cálculo: Utilidad Neta = Precio Venta - Todos los Costos</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {uniqueMonths.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Ingresos Totales</span>
            </div>
            <p className="text-xl font-bold text-emerald-600">{formatPEN(analytics.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Costo Adquisición</span>
            </div>
            <p className="text-xl font-bold text-red-600">{formatPEN(analytics.totalCostAcquisition)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Facebook className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Costo Marketing</span>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatPEN(analytics.totalCostMarketing)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Gastos Operativos</span>
            </div>
            <p className="text-xl font-bold text-blue-600">{formatPEN(analytics.totalCostOperative)}</p>
          </CardContent>
        </Card>
        <Card className={analytics.netProfit >= 0 ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              {analytics.netProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className="text-xs text-muted-foreground font-medium">Utilidad Neta</span>
            </div>
            <p className={`text-xl font-bold ${analytics.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatPEN(analytics.netProfit)}
            </p>
            <p className="text-xs text-muted-foreground">Margen promedio: {analytics.avgMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Best / Worst Product */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {analytics.bestProduct && (
          <Card className="border-emerald-300 dark:border-emerald-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-base">Producto Más Rentable</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{analytics.bestProduct.name}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <div><span className="text-muted-foreground">Ganancia:</span> <span className="font-medium text-emerald-600">{formatPEN(analytics.bestProduct.profit)}</span></div>
                <div><span className="text-muted-foreground">Margen:</span> <span className="font-medium">{analytics.bestProduct.margin.toFixed(1)}%</span></div>
              </div>
            </CardContent>
          </Card>
        )}
        {analytics.worstProduct && analytics.worstProduct.name !== analytics.bestProduct?.name && (
          <Card className="border-red-300 dark:border-red-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="h-5 w-5 text-red-500" />
                <CardTitle className="text-base">Menos Rentable</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="font-semibold">{analytics.worstProduct.name}</p>
              <div className="flex gap-4 mt-2 text-sm">
                <div><span className="text-muted-foreground">Ganancia:</span> <span className={`font-medium ${analytics.worstProduct.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPEN(analytics.worstProduct.profit)}</span></div>
                <div><span className="text-muted-foreground">Margen:</span> <span className="font-medium">{analytics.worstProduct.margin.toFixed(1)}%</span></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Revenue vs Costs vs Profit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingresos vs Costos vs Ganancia</CardTitle>
            <CardDescription>Comparativa mensual</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.monthlyBreakdown.length > 0 ? (
              <ChartContainer config={profitChartConfig} className="h-[300px] w-full">
                <BarChart data={analytics.monthlyBreakdown} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `S/${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costs" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">Sin datos</div>
            )}
          </CardContent>
        </Card>

        {/* Sales by Channel (ROI) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por Canal</CardTitle>
            <CardDescription>ROI de Publicidad y Canales</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.salesByChannel.length > 0 ? (
              <ChartContainer config={{ revenue: { label: 'Ingresos', color: '#10b981' }, profit: { label: 'Ganancia', color: '#3b82f6' } }} className="h-[300px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={analytics.salesByChannel}
                    dataKey="revenue"
                    nameKey="channel"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    strokeWidth={2}
                    label={({ channel, percent }) => `${channel} ${(percent * 100).toFixed(0)}%`}
                  >
                    {analytics.salesByChannel.map((_, index) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">Sin datos</div>
            )}
          </CardContent>
        </Card>

        {/* Margin Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tendencia de Margen</CardTitle>
            <CardDescription>Evolución del margen de ganancia mensual</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.monthlyBreakdown.length > 0 ? (
              <ChartContainer config={marginChartConfig} className="h-[250px] w-full">
                <LineChart data={analytics.monthlyBreakdown} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="margin" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">Sin datos</div>
            )}
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Clientes por Gasto</CardTitle>
            <CardDescription>Clientes que más han comprado</CardDescription>
          </CardHeader>
          <CardContent>
            {topClients.length > 0 ? (
              <div className="space-y-3">
                {topClients.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                      <span className="text-sm font-medium">{c.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatPEN(c.spent)}</p>
                      <p className="text-xs text-muted-foreground">{c.purchases} compra(s)</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos de clientes</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desglose Detallado por Venta</CardTitle>
          <CardDescription>Utilidad neta calculada: Precio Venta - Adquisición - Marketing - Operativo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Venta</TableHead>
                  <TableHead className="text-right">Adquisición</TableHead>
                  <TableHead className="text-right">Marketing</TableHead>
                  <TableHead className="text-right">Operativo</TableHead>
                  <TableHead className="text-right">Utilidad Neta</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSalesBreakdown.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{s.date}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate" title={s.product}>{s.product}</TableCell>
                    <TableCell className="text-sm">{s.client}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatPEN(s.revenue)}</TableCell>
                    <TableCell className="text-right text-sm text-red-600">{formatPEN(s.costAcq)}</TableCell>
                    <TableCell className="text-right text-sm text-amber-600">{formatPEN(s.costMkt)}</TableCell>
                    <TableCell className="text-right text-sm text-blue-600">{formatPEN(s.costOps)}</TableCell>
                    <TableCell className={`text-right text-sm font-bold ${s.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatPEN(s.profit)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <Badge variant="outline" className={s.margin >= 30 ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' : s.margin >= 15 ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' : 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'}>
                        {s.margin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
