'use client';

import { useState, useEffect } from 'react';
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
} from 'recharts';
import { fetchDashboardStats, seedData } from '@/lib/api';
import type { DashboardStats } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, string> = {
  USA: 'bg-yellow-500',
  'En Tránsito': 'bg-sky-500',
  Perú: 'bg-purple-500',
  Entregado: 'bg-emerald-500',
  Vendido: 'bg-zinc-500',
};

const lineChartConfig: ChartConfig = {
  revenue: { label: 'Ingresos', color: '#10b981' },
  profit: { label: 'Ganancia', color: '#3b82f6' },
};

const pieChartConfig: ChartConfig = {
  A: { label: 'Grado A', color: '#10b981' },
  B: { label: 'Grado B', color: '#f59e0b' },
  C: { label: 'Grado C', color: '#ef4444' },
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'];
const CHANNEL_COLORS = ['#f59e0b', '#10b981', '#22c55e', '#3b82f6'];

export function DashboardTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard ERP</h2>
          <p className="text-muted-foreground">Resumen general de tu negocio de importación</p>
        </div>
        <Button onClick={handleSeed} disabled={seeding} variant="outline" className="gap-2">
          <Database className="h-4 w-4" />
          {seeding ? 'Cargando...' : 'Cargar Datos de Ejemplo'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent>
            </Card>
          ))
        ) : stats ? (
          <>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Capital Invertido</span>
                </div>
                <p className="text-lg font-bold text-amber-600">{formatPEN(stats.totalInvested)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Ingresos</span>
                </div>
                <p className="text-lg font-bold text-emerald-600">{formatPEN(stats.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card className={stats.netProfit >= 0 ? 'border-emerald-200' : 'border-red-200'}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className={`h-4 w-4 ${stats.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
                  <span className="text-xs text-muted-foreground">Ganancia Neta</span>
                </div>
                <p className={`text-lg font-bold ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatPEN(stats.netProfit)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <PackageCheck className="h-4 w-4 text-sky-500" />
                  <span className="text-xs text-muted-foreground">Stock Activo</span>
                </div>
                <p className="text-lg font-bold">{stats.activeProducts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-violet-500" />
                  <span className="text-xs text-muted-foreground">Clientes</span>
                </div>
                <p className="text-lg font-bold">{stats.totalClients}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Ticket className="h-4 w-4 text-rose-500" />
                  <span className="text-xs text-muted-foreground">Ticket Prom.</span>
                </div>
                <p className="text-lg font-bold">{formatPEN(stats.avgTicket)}</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No hay datos disponibles. Haz clic en &quot;Cargar Datos de Ejemplo&quot; para comenzar.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {stats && (
        <>
          {/* Inventory Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Estado del Inventario</CardTitle>
              <CardDescription>Distribución de productos por estado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(stats.productsByStatus).map(([status, count]) => {
                const total = Object.values(stats.productsByStatus).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${statusColors[status] || 'bg-zinc-400'}`} />
                    <div className="w-24 shrink-0 text-sm font-medium">{status}</div>
                    <div className="flex-1"><Progress value={pct} className="h-2.5" /></div>
                    <div className="w-20 text-right text-sm text-muted-foreground">
                      {count} ({Math.round(pct)}%)
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Charts Row 1 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue & Profit Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ingresos y Ganancia Mensual</CardTitle>
                <CardDescription>Últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.monthlyRevenue.length > 0 ? (
                  <ChartContainer config={lineChartConfig} className="h-[250px] w-full">
                    <LineChart data={stats.monthlyRevenue} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `S/${(v / 1000).toFixed(0)}k`} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} strokeDasharray="5 5" />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">Sin datos de ingresos</div>
                )}
              </CardContent>
            </Card>

            {/* Products by Grade */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Productos por Grado</CardTitle>
                <CardDescription>Distribución A/B/C</CardDescription>
              </CardHeader>
              <CardContent>
                {Object.values(stats.productsByGrade).some((v) => v > 0) ? (
                  <ChartContainer config={pieChartConfig} className="h-[250px] w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={[
                          { name: 'A', value: stats.productsByGrade.A },
                          { name: 'B', value: stats.productsByGrade.B },
                          { name: 'C', value: stats.productsByGrade.C },
                        ].filter((d) => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        strokeWidth={2}
                      >
                        {['A', 'B', 'C'].map((entry, index) => (
                          <Cell key={entry} fill={PIE_COLORS[index]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[250px] items-center justify-center text-muted-foreground text-sm">Sin datos de grados</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Selling Products */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Producto Más Vendido</CardTitle>
                    <CardDescription>Ranking por unidades vendidas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {stats.topSellingProducts.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topSellingProducts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium max-w-[200px] truncate">{p.name}</span>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mr-2">{p.quantity} u.</Badge>
                          <span className="text-sm font-medium text-emerald-600">{formatPEN(p.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin ventas registradas</p>
                )}
              </CardContent>
            </Card>

            {/* Sales by Channel */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ventas por Canal</CardTitle>
                <CardDescription>ROI de Publicidad por Canal</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.salesByChannel.length > 0 ? (
                  <div className="space-y-3">
                    {stats.salesByChannel.map((ch, i) => {
                      const totalRev = stats.salesByChannel.reduce((s, c) => s + c.revenue, 0);
                      const pct = totalRev > 0 ? (ch.revenue / totalRev) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${CHANNEL_COLORS[i % CHANNEL_COLORS.length]}`} />
                          <div className="w-28 shrink-0 text-sm font-medium">{ch.channel}</div>
                          <div className="flex-1"><Progress value={pct} className="h-2.5" /></div>
                          <div className="w-24 text-right text-sm">
                            <span className="font-medium">{formatPEN(ch.revenue)}</span>
                            <span className="text-muted-foreground ml-1">({ch.count})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin datos por canal</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* NRUS Alert */}
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base">Alerta NRUS</CardTitle>
              </div>
              <CardDescription>
                Monitorea tus ventas mensuales para no exceder los límites del Nuevo Régimen Único Simplificado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Ventas del mes</span>
                <span className="font-semibold">S/ {stats.nrus.totalMonthlySalesPen.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</span>
              </div>
              <Progress value={Math.min((stats.nrus.totalMonthlySalesPen / 8000) * 100, 100)} className="h-3" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Límite Categoría 2</span>
                <span className="font-medium">S/ 8,000</span>
              </div>
              <Badge variant="outline" className={
                stats.nrus.alertLevel === 'exceeded' ? 'bg-red-100 text-red-700 border-red-300' :
                stats.nrus.alertLevel === 'danger' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                stats.nrus.alertLevel === 'warning' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                'bg-emerald-100 text-emerald-700 border-emerald-300'
              }>
                {stats.nrus.category}: {stats.nrus.percentageOfThreshold.toFixed(0)}% del límite
              </Badge>
            </CardContent>
          </Card>

          {/* Recent Sales */}
          {stats.recentSales.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Ventas Recientes</CardTitle>
                    <CardDescription>Últimas transacciones completadas</CardDescription>
                  </div>
                  {onNavigate && (
                    <Button variant="outline" size="sm" onClick={() => onNavigate('ventas')}>Ver todas</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Precio</TableHead>
                        <TableHead className="text-right">Ganancia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentSales.slice(0, 5).map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm">
                            {new Date(s.saleDate).toLocaleDateString('es-PE')}
                          </TableCell>
                          <TableCell className="font-medium max-w-[180px] truncate" title={s.productDescription}>
                            {s.productDescription}
                          </TableCell>
                          <TableCell className="text-sm">{s.clientName}</TableCell>
                          <TableCell className="text-right font-medium">{formatPEN(s.salePricePen)}</TableCell>
                          <TableCell className={`text-right font-medium ${s.netProfitPen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatPEN(s.netProfitPen)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Products */}
          {stats.recentProducts.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Productos Recientes</CardTitle>
                    <CardDescription>Últimos productos agregados al inventario</CardDescription>
                  </div>
                  {onNavigate && (
                    <Button variant="outline" size="sm" onClick={() => onNavigate('productos')}>Ver todos</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Precio Compra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.recentProducts.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium max-w-[250px] truncate">{p.description}</TableCell>
                          <TableCell><StatusBadge status={p.status} /></TableCell>
                          <TableCell className="text-right">${p.purchasePriceUSD.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    USA: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'En Tránsito': 'bg-sky-100 text-sky-800 border-sky-300',
    Perú: 'bg-purple-100 text-purple-800 border-purple-300',
    Entregado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    Vendido: 'bg-zinc-100 text-zinc-800 border-zinc-300',
  };
  return (
    <Badge variant="outline" className={styles[status] || ''}>
      {status}
    </Badge>
  );
}
