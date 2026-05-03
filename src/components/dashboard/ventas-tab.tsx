'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchSales,
  fetchAvailableProducts,
  fetchClients,
  createSale,
} from '@/lib/api';
import type { Sale, Product, Client, SaleFormData, SaleChannel, PaymentMethod } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const channelColors: Record<string, string> = {
  MercadoLibre: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  Tienda: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  WhatsApp: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  Facebook: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
};

const deliveryColors: Record<string, string> = {
  Pendiente: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  'En camino': 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
  Entregado: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
};

export function VentasTab() {
  const { toast } = useToast();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form data
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<SaleFormData>({
    productId: '',
    clientId: '',
    salePricePen: 0,
    costMarketingPen: 0,
    costOperativePen: 0,
    saleChannel: 'MercadoLibre',
    paymentMethod: 'Efectivo',
    warrantyMonths: 3,
    warrantyNotes: '',
  });

  const loadSales = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSales({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setSales(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las ventas', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const loadFormData = async () => {
    try {
      const [products, clientsData] = await Promise.all([
        fetchAvailableProducts(),
        fetchClients(),
      ]);
      setAvailableProducts(products);
      setClients(clientsData);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los datos del formulario', variant: 'destructive' });
    }
  };

  const handleOpenDialog = async () => {
    await loadFormData();
    setForm({
      productId: '',
      clientId: '',
      salePricePen: 0,
      costMarketingPen: 0,
      costOperativePen: 0,
      saleChannel: 'MercadoLibre',
      paymentMethod: 'Efectivo',
      warrantyMonths: 3,
      warrantyNotes: '',
    });
    setSelectedProduct(null);
    setDialogOpen(true);
  };

  const handleProductSelect = (productId: string) => {
    const product = availableProducts.find(p => p.id === productId);
    setSelectedProduct(product || null);
    // Auto-calculate suggested price (cost + 35% margin)
    const suggestedPrice = product ? Math.round(product.totalCostPEN * 1.35) : 0;
    setForm({
      ...form,
      productId,
      salePricePen: suggestedPrice,
      costMarketingPen: product ? product.advertisingCostUSD * product.exchangeRate : 0,
    });
  };

  const handleSubmit = async () => {
    if (!form.productId || !form.clientId || form.salePricePen <= 0) {
      toast({ title: 'Error', description: 'Selecciona un producto, un cliente y un precio de venta', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await createSale(form);
      toast({
        title: 'Venta registrada',
        description: `Venta de ${selectedProduct?.description || 'producto'} registrada correctamente. Stock actualizado.`,
      });
      setDialogOpen(false);
      await loadSales();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo registrar la venta';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filteredSales = search
    ? sales.filter(s =>
        s.productDescription.toLowerCase().includes(search.toLowerCase()) ||
        s.clientName.toLowerCase().includes(search.toLowerCase()) ||
        s.clientDniRuc.includes(search)
      )
    : sales;

  // Stats
  const totalRevenue = sales.reduce((sum, s) => sum + s.salePricePen, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.netProfitPen, 0);
  const pendingDelivery = sales.filter(s => s.deliveryStatus === 'Pendiente').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Registro de Ventas</h2>
          <p className="text-muted-foreground">Registra ventas y vincula clientes con productos</p>
        </div>
        <Button onClick={handleOpenDialog} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4" />
          Nueva Venta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{formatPEN(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Ingresos Totales</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-100 p-2">
                <CheckCircle className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-sky-600">{formatPEN(totalProfit)}</p>
                <p className="text-xs text-muted-foreground">Ganancia Neta</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <Truck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingDelivery}</p>
                <p className="text-xs text-muted-foreground">Entregas Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por producto o cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Completada">Completada</SelectItem>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No hay ventas registradas</p>
              <p className="text-sm">Registra tu primera venta para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Entrega</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    <TableHead className="text-right">Ganancia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">
                        {new Date(s.saleDate).toLocaleDateString('es-PE')}
                      </TableCell>
                      <TableCell className="font-medium max-w-[180px] truncate" title={s.productDescription}>
                        {s.productDescription}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{s.clientName}</p>
                          <p className="text-xs text-muted-foreground">{s.clientDniRuc || s.clientCelular}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={channelColors[s.saleChannel] || ''}>
                          {s.saleChannel || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={deliveryColors[s.deliveryStatus] || ''}>
                          {s.deliveryStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPEN(s.salePricePen)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${s.netProfitPen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatPEN(s.netProfitPen)}
                        <span className="text-xs text-muted-foreground ml-1">({s.profitMargin.toFixed(1)}%)</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Sale Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[95vh] sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Nueva Venta</DialogTitle>
            <DialogDescription>
              Selecciona un producto disponible y un cliente. El stock se actualizará automáticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Product Selection */}
            <div className="space-y-2">
              <Label>Producto *</Label>
              <Select value={form.productId} onValueChange={handleProductSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto disponible..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.description} - Costo: {formatPEN(p.totalCostPEN)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableProducts.length === 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No hay productos disponibles (Entregado/Perú). Primero recibe productos del envío.
                </p>
              )}
            </div>

            {/* Selected product info */}
            {selectedProduct && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Modelo:</span> {selectedProduct.model || selectedProduct.description}</div>
                  <div><span className="text-muted-foreground">Grado:</span> <Badge variant="outline">Grado {selectedProduct.grade}</Badge></div>
                  <div><span className="text-muted-foreground">Costo Total:</span> <span className="font-medium">{formatPEN(selectedProduct.totalCostPEN)}</span></div>
                  <div><span className="text-muted-foreground">Impuestos:</span> {formatPEN(selectedProduct.taxesPEN)}</div>
                </div>
              </div>
            )}

            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName} {c.dniRuc ? `(${c.dniRuc})` : ''} {c.celular ? `- ${c.celular}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label>Precio de Venta (S/) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.salePricePen || ''}
                onChange={(e) => setForm({ ...form, salePricePen: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            {/* Cost breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Costo Marketing (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.costMarketingPen || ''}
                  onChange={(e) => setForm({ ...form, costMarketingPen: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Gastos Operativos (S/)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.costOperativePen || ''}
                  onChange={(e) => setForm({ ...form, costOperativePen: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Channel and Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Canal de Venta</Label>
                <Select value={form.saleChannel} onValueChange={(v) => setForm({ ...form, saleChannel: v as SaleChannel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MercadoLibre">MercadoLibre</SelectItem>
                    <SelectItem value="Tienda">Tienda</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Método de Pago</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v as PaymentMethod })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Yape">Yape</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                    <SelectItem value="MercadoPago">MercadoPago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Profit Preview */}
            {selectedProduct && form.salePricePen > 0 && (
              <div className="rounded-lg border-2 p-3 space-y-1">
                <p className="text-sm font-semibold">Vista Previa de Utilidad</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Costo Adquisición:</span>
                    <span className="font-medium">{formatPEN(selectedProduct.totalCostPEN)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Costo Marketing:</span>
                    <span className="font-medium">{formatPEN(form.costMarketingPen)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gastos Operativos:</span>
                    <span className="font-medium">{formatPEN(form.costOperativePen)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1">
                    <span className="font-semibold">Utilidad Neta:</span>
                    <span className={`font-bold ${(form.salePricePen - selectedProduct.totalCostPEN - form.costMarketingPen - form.costOperativePen) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatPEN(form.salePricePen - selectedProduct.totalCostPEN - form.costMarketingPen - form.costOperativePen)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.productId || !form.clientId || form.salePricePen <= 0}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? 'Registrando...' : 'Registrar Venta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
