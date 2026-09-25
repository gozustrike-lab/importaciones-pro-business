'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Truck,
  Search,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Plane,
  ShieldCheck,
  RefreshCw,
  Barcode,
  LayoutGrid,
  List,
  Sparkles,
  Share2,
  Plus,
  Send,
  Calendar,
  PackageCheck,
  ArrowRight,
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
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchProducts, fetchTracking, updateProduct, addTrackingUpdate } from '@/lib/api';
import type { Product, TrackingUpdate } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// ── Helpers ──
function getCarrierTrackingUrl(courier: string, tracking: string): string {
  const c = (courier || '').toUpperCase();
  const cleanT = tracking.replace(/\s+/g, '').trim();
  const encoded = encodeURIComponent(cleanT);

  if (c.includes('UPS') || cleanT.startsWith('1Z')) {
    return `https://www.ups.com/track?loc=en_US&tracknum=${encoded}`;
  }
  if (
    c.includes('USPS') ||
    cleanT.startsWith('94') ||
    cleanT.startsWith('92') ||
    cleanT.startsWith('93') ||
    (cleanT.length >= 20 && /^\d+$/.test(cleanT))
  ) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
  }
  if (c.includes('FEDEX') || (cleanT.length === 12 && /^\d+$/.test(cleanT))) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
  }
  return `https://t.17track.net/en#nums=${encoded}`;
}

function getCarrierBadgeInfo(courier: string, tracking: string) {
  const c = (courier || '').toUpperCase();
  const cleanT = (tracking || '').trim();

  if (c.includes('UPS') || cleanT.startsWith('1Z')) {
    return {
      label: 'UPS',
      color: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
      icon: '📦',
      officialSite: 'UPS Official',
    };
  }
  if (
    c.includes('USPS') ||
    cleanT.startsWith('94') ||
    cleanT.startsWith('92') ||
    cleanT.startsWith('93') ||
    (cleanT.length >= 20 && /^\d+$/.test(cleanT))
  ) {
    return {
      label: 'USPS',
      color: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800',
      icon: '✉️',
      officialSite: 'USPS Official',
    };
  }
  if (c.includes('FEDEX') || (cleanT.length === 12 && /^\d+$/.test(cleanT))) {
    return {
      label: 'FedEx',
      color: 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800',
      icon: '⚡',
      officialSite: 'FedEx Official',
    };
  }
  return {
    label: courier || 'Postal',
    color: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: '🚚',
    officialSite: '17Track',
  };
}

export function TrackingTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'transito' | 'miami' | 'shipper_ok' | 'peru'>('all');
  const [courierFilter, setCourierFilter] = useState<'all' | 'UPS' | 'USPS' | 'FEDEX'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Tracking timeline expansion & data cache
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<Record<string, TrackingUpdate[]>>({});
  const [loadingTrackingId, setLoadingTrackingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Manual Checkpoint Dialog
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newStatus, setNewStatus] = useState('En Tránsito');
  const [newLocation, setNewLocation] = useState('Miami, FL 33172');
  const [newDescription, setNewDescription] = useState('');
  const [savingCheckpoint, setSavingCheckpoint] = useState(false);

  // Load all products with tracking
  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProducts();
      // Keep only products with actual tracking numbers
      const withTracking = data.filter((p) => p.trackingNumber && p.trackingNumber.trim() !== '');
      setProducts(withTracking);
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los envíos con tracking',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
    toast({ title: 'Actualizado', description: 'Lista de envíos y trackings sincronizada.' });
  };

  // Toggle Tracking View & Load
  const handleToggleTracking = async (productId: string) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }

    if (trackingData[productId]) {
      setExpandedProduct(productId);
      return;
    }

    try {
      setLoadingTrackingId(productId);
      const data = await fetchTracking(productId);
      setTrackingData((prev) => ({ ...prev, [productId]: data }));
      setExpandedProduct(productId);
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los checkpoints de este tracking',
        variant: 'destructive',
      });
    } finally {
      setLoadingTrackingId(null);
    }
  };

  // 1-Click Toggle Shipper Confirmation
  const handleToggleShipperConfirmed = async (product: Product) => {
    const nextVal = !product.shipperConfirmed;
    try {
      await updateProduct(product.id, { shipperConfirmed: nextVal } as any);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, shipperConfirmed: nextVal } : p))
      );
      toast({
        title: nextVal ? '✓ Almacén Shiper OK' : 'Estado Shiper actualizado',
        description: `${product.trackingNumber} ${
          nextVal ? 'verificado en almacén de Shiper Miami' : 'marcado como pendiente de confirmación'
        }`,
      });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado de Shiper',
        variant: 'destructive',
      });
    }
  };

  // Copy tracking number
  const handleCopy = (text: string, id: string, label: string = 'Tracking') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: `${label} copiado`, description: text });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export list of pending Miami trackings for WhatsApp
  const handleCopyPendingForWhatsApp = () => {
    const pendingInMiami = products.filter(
      (p) =>
        (p.status === 'USA' || p.status === 'TRANSITO_USA' || p.status === 'En Tránsito') &&
        !p.shipperConfirmed
    );

    if (pendingInMiami.length === 0) {
      toast({
        title: 'Sin trackings pendientes',
        description: 'Todos los productos en Miami ya están confirmados por Shiper.',
      });
      return;
    }

    const message = [
      'VERIFICAR PORFAVOR (Almacén Miami - Shiper):',
      '',
      ...pendingInMiami.map((p) => p.trackingNumber),
      '',
      `Total: ${pendingInMiami.length} paquetes a verificar.`,
    ].join('\n');

    navigator.clipboard.writeText(message);
    toast({
      title: '📋 Lista para WhatsApp Copiada',
      description: `${pendingInMiami.length} trackings copiados en formato oficial para enviar a Shiper.`,
    });
  };

  // Add Manual Checkpoint
  const handleOpenManualCheckpoint = (product: Product) => {
    setSelectedProduct(product);
    setNewStatus('Almacén Shiper OK');
    setNewLocation('Shiper Courier Miami (8298 NW 68th St)');
    setNewDescription('Paquete verificado físicamente y recibido conforme.');
    setManualModalOpen(true);
  };

  const handleSaveManualCheckpoint = async () => {
    if (!selectedProduct) return;
    try {
      setSavingCheckpoint(true);
      const update = await addTrackingUpdate(selectedProduct.id, {
        status: newStatus,
        location: newLocation,
        description: newDescription,
        date: new Date().toISOString(),
      });

      setTrackingData((prev) => ({
        ...prev,
        [selectedProduct.id]: [update, ...(prev[selectedProduct.id] || [])],
      }));

      // If status indicates shipper confirmation, also reflect on product
      if (newStatus === 'Almacén Shiper OK') {
        await updateProduct(selectedProduct.id, { shipperConfirmed: true } as any);
        setProducts((prev) =>
          prev.map((p) => (p.id === selectedProduct.id ? { ...p, shipperConfirmed: true } : p))
        );
      }

      toast({
        title: 'Checkpoint registrado',
        description: 'Actualización de tracking guardada en base de datos.',
      });
      setManualModalOpen(false);
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la actualización',
        variant: 'destructive',
      });
    } finally {
      setSavingCheckpoint(false);
    }
  };

  // ── KPI Statistics ──
  const stats = useMemo(() => {
    const total = products.length;
    const inTransit = products.filter(
      (p) => p.status === 'TRANSITO_USA' || p.status === 'En Tránsito'
    ).length;
    const inMiami = products.filter((p) => p.status === 'USA').length;
    const shipperOk = products.filter((p) => p.shipperConfirmed).length;
    const inPeru = products.filter(
      (p) => p.status === 'Entregado' || p.status === 'Perú'
    ).length;

    return { total, inTransit, inMiami, shipperOk, inPeru };
  }, [products]);

  // ── Filtered Products ──
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Status filter
      if (statusFilter === 'transito') {
        if (p.status !== 'TRANSITO_USA' && p.status !== 'En Tránsito') return false;
      } else if (statusFilter === 'miami') {
        if (p.status !== 'USA') return false;
      } else if (statusFilter === 'shipper_ok') {
        if (!p.shipperConfirmed) return false;
      } else if (statusFilter === 'peru') {
        if (p.status !== 'Entregado' && p.status !== 'Perú') return false;
      }

      // Courier filter
      if (courierFilter !== 'all') {
        const c = (p.courier || '').toUpperCase();
        const t = (p.trackingNumber || '').toUpperCase();
        if (courierFilter === 'UPS' && !c.includes('UPS') && !t.startsWith('1Z')) return false;
        if (
          courierFilter === 'USPS' &&
          !c.includes('USPS') &&
          !t.startsWith('94') &&
          !t.startsWith('92') &&
          !t.startsWith('93')
        )
          return false;
        if (courierFilter === 'FEDEX' && !c.includes('FEDEX') && t.length !== 12) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTracking = p.trackingNumber.toLowerCase().includes(q);
        const matchesShipperTracking = (p.shipperTracking || '').toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesModel = (p.model || '').toLowerCase().includes(q);
        const matchesOrder = (p.orderNumber || '').toLowerCase().includes(q);
        const matchesCourier = (p.courier || '').toLowerCase().includes(q);
        if (
          !matchesTracking &&
          !matchesShipperTracking &&
          !matchesDesc &&
          !matchesModel &&
          !matchesOrder &&
          !matchesCourier
        ) {
          return false;
        }
      }

      return true;
    });
  }, [products, statusFilter, courierFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              Tracking USA & Logística
            </h2>
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs">
              {products.length} Envíos Activos
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monitoreo en tiempo real de couriers estadounidenses (UPS, USPS, FedEx) y validación en almacén Shiper Miami.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyPendingForWhatsApp}
            className="h-8 text-xs font-semibold gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            title="Copiar lista de paquetes pendientes en Miami para enviar a Shiper por WhatsApp"
          >
            <Send className="h-3.5 w-3.5 text-emerald-600" />
            <span>Copiar para WhatsApp Courier</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 text-xs font-semibold gap-1.5"
            title="Refrescar datos desde la base de datos"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </Button>

          <div className="flex items-center border rounded-md p-0.5 bg-muted/30">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
              className="h-7 w-7 p-0"
              title="Vista de cuadrícula con timeline"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              onClick={() => setViewMode('table')}
              className="h-7 w-7 p-0"
              title="Vista de tabla logística compacta"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card
          onClick={() => setStatusFilter('all')}
          className={`p-3 cursor-pointer transition-all border ${
            statusFilter === 'all'
              ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
              : 'hover:border-border hover:bg-muted/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Envíos</span>
            <Truck className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-foreground">{stats.total}</div>
          <p className="text-[11px] text-muted-foreground mt-0.5">En base de datos</p>
        </Card>

        <Card
          onClick={() => setStatusFilter('transito')}
          className={`p-3 cursor-pointer transition-all border ${
            statusFilter === 'transito'
              ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20'
              : 'hover:border-sky-300 hover:bg-sky-50/30 dark:hover:bg-sky-950/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-sky-700 dark:text-sky-300">En Tránsito USA</span>
            <Truck className="h-4 w-4 text-sky-600 animate-pulse" />
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-sky-700 dark:text-sky-300">
            {stats.inTransit}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Hacia almacén Miami</p>
        </Card>

        <Card
          onClick={() => setStatusFilter('miami')}
          className={`p-3 cursor-pointer transition-all border ${
            statusFilter === 'miami'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20'
              : 'hover:border-amber-300 hover:bg-amber-50/30 dark:hover:bg-amber-950/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">En Miami</span>
            <Building2 className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
            {stats.inMiami}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Casillero postal 33172</p>
        </Card>

        <Card
          onClick={() => setStatusFilter('shipper_ok')}
          className={`p-3 cursor-pointer transition-all border ${
            statusFilter === 'shipper_ok'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20'
              : 'hover:border-emerald-300 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Shiper OK</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
            {stats.shipperOk}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Listos para embarque</p>
        </Card>

        <Card
          onClick={() => setStatusFilter('peru')}
          className={`p-3 cursor-pointer transition-all border col-span-2 sm:col-span-1 ${
            statusFilter === 'peru'
              ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/50 dark:bg-purple-950/20'
              : 'hover:border-purple-300 hover:bg-purple-50/30 dark:hover:bg-purple-950/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Entregados Perú</span>
            <Plane className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-1 text-2xl font-bold font-mono text-purple-700 dark:text-purple-300">
            {stats.inPeru}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">Lima / Callao</p>
        </Card>
      </div>

      {/* ── Filters & Search Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por tracking, descripción de producto, modelo, orden de eBay..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs sm:text-sm h-9"
          />
        </div>

        {/* Courier Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Button
            size="sm"
            variant={courierFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setCourierFilter('all')}
            className="h-8 text-xs font-medium px-2.5"
          >
            Todos
          </Button>
          <Button
            size="sm"
            variant={courierFilter === 'UPS' ? 'default' : 'outline'}
            onClick={() => setCourierFilter('UPS')}
            className={`h-8 text-xs font-medium px-2.5 gap-1 ${
              courierFilter === 'UPS' ? '' : 'text-amber-800 dark:text-amber-300 border-amber-300'
            }`}
          >
            <span>📦 UPS</span>
          </Button>
          <Button
            size="sm"
            variant={courierFilter === 'USPS' ? 'default' : 'outline'}
            onClick={() => setCourierFilter('USPS')}
            className={`h-8 text-xs font-medium px-2.5 gap-1 ${
              courierFilter === 'USPS' ? '' : 'text-blue-800 dark:text-blue-300 border-blue-300'
            }`}
          >
            <span>✉️ USPS</span>
          </Button>
          <Button
            size="sm"
            variant={courierFilter === 'FEDEX' ? 'default' : 'outline'}
            onClick={() => setCourierFilter('FEDEX')}
            className={`h-8 text-xs font-medium px-2.5 gap-1 ${
              courierFilter === 'FEDEX' ? '' : 'text-purple-800 dark:text-purple-300 border-purple-300'
            }`}
          >
            <span>⚡ FedEx</span>
          </Button>
        </div>
      </div>

      {/* ── Content View ── */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <h3 className="text-base font-bold text-foreground">No se encontraron envíos</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            No hay paquetes que coincidan con los filtros aplicados. Intenta restablecer el buscador o cambiar de filtro de estado.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setCourierFilter('all');
            }}
            className="mt-4 text-xs font-medium"
          >
            Restablecer Filtros
          </Button>
        </Card>
      ) : viewMode === 'grid' ? (
        /* ── GRID VIEW (CARDS WITH ACCORDION TIMELINE) ── */
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProducts.map((product) => {
            const updates = trackingData[product.id] || [];
            const isExpanded = expandedProduct === product.id;
            const carrierBadge = getCarrierBadgeInfo(product.courier, product.trackingNumber);
            const officialUrl = getCarrierTrackingUrl(product.courier, product.trackingNumber);
            const isDeliveredMiami =
              product.status === 'USA' || product.status === 'Entregado' || Boolean(product.actualDeliveryDate);
            const isPeru = product.status === 'Entregado' || product.status === 'Perú';

            return (
              <Card
                key={product.id}
                className="overflow-hidden border transition-all hover:border-primary/50 shadow-xs flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-3 bg-muted/20 border-b">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      {/* Carrier & Tracking Header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-bold px-2 py-0.5 gap-1 ${carrierBadge.color}`}
                        >
                          <span>{carrierBadge.icon}</span>
                          <span>{carrierBadge.label}</span>
                        </Badge>

                        <div className="flex items-center gap-1 font-mono text-xs font-bold text-foreground bg-background px-2 py-0.5 rounded border">
                          <span>{product.trackingNumber}</span>
                          <button
                            onClick={() => handleCopy(product.trackingNumber, product.id, 'Tracking')}
                            className="p-0.5 hover:text-primary transition-colors"
                            title="Copiar tracking"
                          >
                            {copiedId === product.id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        </div>

                        {product.shipperConfirmed ? (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0 gap-1 shadow-2xs">
                            <ShieldCheck className="h-3 w-3" />
                            Almacén Shiper OK
                          </Badge>
                        ) : isDeliveredMiami && !isPeru ? (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-bold px-1.5 py-0 gap-1"
                          >
                            <Clock className="h-3 w-3" />
                            Pendiente Shiper
                          </Badge>
                        ) : null}
                      </div>

                      {/* Product Title */}
                      <CardTitle
                        className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug pt-1"
                        title={product.description}
                      >
                        {product.description}
                      </CardTitle>

                      {/* Order & Recipient info */}
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-0.5 flex-wrap">
                        {product.orderNumber && (
                          <span className="font-mono">
                            Orden: <strong className="text-foreground">{product.orderNumber}</strong>
                          </span>
                        )}
                        {product.recipientName && (
                          <span>
                            • Destino: <span className="font-medium text-foreground">{product.recipientName}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Official Tracker Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(officialUrl, '_blank')}
                      className="h-7 px-2 text-[11px] font-bold gap-1 shrink-0 bg-background hover:bg-muted"
                      title={`Abrir rastreo en sitio oficial ${carrierBadge.officialSite}`}
                    >
                      <ExternalLink className="h-3 w-3 text-primary" />
                      <span className="hidden sm:inline">Rastrear</span>
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-3 space-y-3">
                  {/* Shiper GS1 Barcode reference if available */}
                  {product.shipperTracking && (
                    <div className="p-2 rounded bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-[11px] text-amber-900 dark:text-amber-200">
                      <div className="flex items-center gap-1.5 truncate">
                        <Barcode className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                        <span className="font-mono text-[10px] truncate" title={product.shipperTracking}>
                          {product.shipperTracking}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          handleCopy(product.shipperTracking!, `${product.id}-shipper`, 'Código Shiper')
                        }
                        className="text-[10px] font-bold text-amber-800 hover:underline shrink-0 ml-2"
                      >
                        {copiedId === `${product.id}-shipper` ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                  )}

                  {/* Dates & Quick Status Row */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] p-2 rounded-md bg-muted/30 border">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Fecha Compra:</span>
                      <span className="font-medium text-foreground">
                        {product.purchaseDate
                          ? new Date(product.purchaseDate).toLocaleDateString('es-PE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'No registrada'}
                      </span>
                    </div>

                    <div>
                      <span className="text-muted-foreground block text-[10px]">Arribo Miami:</span>
                      <span className="font-medium text-foreground">
                        {product.actualDeliveryDate || product.estimatedDeliveryDate
                          ? new Date(
                              product.actualDeliveryDate || product.estimatedDeliveryDate!
                            ).toLocaleDateString('es-PE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'En tránsito'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant={isExpanded ? 'secondary' : 'outline'}
                      size="sm"
                      className="flex-1 h-8 text-xs font-semibold gap-1.5"
                      onClick={() => handleToggleTracking(product.id)}
                      disabled={loadingTrackingId === product.id}
                    >
                      {loadingTrackingId === product.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Truck className="h-3.5 w-3.5 text-primary" />
                      )}
                      <span>
                        {isExpanded ? 'Ocultar Checkpoints' : `Paso a Paso (${updates.length || 'Ver'})`}
                      </span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleShipperConfirmed(product)}
                      className={`h-8 text-xs font-semibold gap-1 ${
                        product.shipperConfirmed
                          ? 'border-emerald-300 text-emerald-700 bg-emerald-50/50 hover:bg-emerald-100 dark:bg-emerald-950/30'
                          : 'border-slate-300 hover:bg-muted text-slate-700 dark:text-slate-300'
                      }`}
                      title={
                        product.shipperConfirmed
                          ? 'Marcar como pendiente en Shiper'
                          : 'Confirmar recepción en almacén Shiper'
                      }
                    >
                      <CheckCircle2
                        className={`h-3.5 w-3.5 ${
                          product.shipperConfirmed ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                      <span>{product.shipperConfirmed ? 'Shiper OK' : 'Confirmar'}</span>
                    </Button>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenManualCheckpoint(product)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Agregar checkpoint manual"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* ── EXPANDED CHRONOLOGICAL STEP-BY-STEP TIMELINE ── */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between pb-2">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          Historial Completo de Checkpoints:
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {updates.length} Registros
                        </Badge>
                      </div>

                      {updates.length === 0 ? (
                        <div className="text-center py-6 text-xs text-muted-foreground bg-muted/20 rounded-md">
                          <p>No se encontraron checkpoints para este envío.</p>
                          <Button
                            size="sm"
                            variant="link"
                            onClick={() => handleOpenManualCheckpoint(product)}
                            className="text-xs text-primary mt-1"
                          >
                            + Agregar primer checkpoint
                          </Button>
                        </div>
                      ) : (
                        <div className="relative pl-3 mt-2 space-y-4">
                          {/* Timeline vertical bar */}
                          <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-border" />

                          {updates.map((update, idx) => {
                            const isLatest = idx === 0;
                            const isDelivered =
                              update.status.includes('Entregado') || update.status.includes('Shiper OK');

                            return (
                              <div key={update.id} className="relative flex gap-3">
                                {/* Dot indicator */}
                                <div className="relative z-10 mt-0.5">
                                  <div
                                    className={`h-4 w-4 rounded-full flex items-center justify-center border-2 ${
                                      isLatest
                                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-2xs'
                                        : isDelivered
                                        ? 'bg-blue-500 border-blue-600 text-white'
                                        : 'bg-background border-muted-foreground/40'
                                    }`}
                                  >
                                    {isLatest ? (
                                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                                    ) : null}
                                  </div>
                                </div>

                                {/* Content Card */}
                                <div className="flex-1 bg-card p-2.5 rounded-lg border text-xs shadow-2xs">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <Badge
                                      variant={isLatest ? 'default' : 'secondary'}
                                      className="text-[10px] font-bold px-1.5 py-0"
                                    >
                                      {update.status}
                                    </Badge>

                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      {new Date(update.date).toLocaleString('es-PE', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>

                                  <p className="font-medium text-foreground mt-1 leading-snug">
                                    {update.description}
                                  </p>

                                  {update.location && (
                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                                      <MapPin className="h-3 w-3 text-red-500 shrink-0" />
                                      <span>{update.location}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ── TABLE VIEW (LOGISTICS OPERATOR VIEW) ── */
        <div className="border rounded-lg overflow-hidden bg-card shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-[120px]">Courier</TableHead>
                <TableHead className="w-[190px]">Tracking Number</TableHead>
                <TableHead>Producto / Descripción</TableHead>
                <TableHead className="w-[150px]">Estado Courier</TableHead>
                <TableHead className="w-[140px] text-center">Almacén Shiper</TableHead>
                <TableHead className="w-[110px]">Fecha Compra</TableHead>
                <TableHead className="w-[110px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const carrierBadge = getCarrierBadgeInfo(product.courier, product.trackingNumber);
                const officialUrl = getCarrierTrackingUrl(product.courier, product.trackingNumber);

                return (
                  <TableRow key={product.id} className="hover:bg-muted/30">
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold px-1.5 py-0 gap-1 ${carrierBadge.color}`}
                      >
                        <span>{carrierBadge.icon}</span>
                        <span>{carrierBadge.label}</span>
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1 font-mono text-xs font-bold text-foreground">
                        <span className="truncate max-w-[140px]">{product.trackingNumber}</span>
                        <button
                          onClick={() => handleCopy(product.trackingNumber, product.id, 'Tracking')}
                          className="p-0.5 hover:text-primary transition-colors shrink-0"
                          title="Copiar tracking"
                        >
                          {copiedId === product.id ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                      {product.shipperTracking && (
                        <span
                          className="font-mono text-[9px] text-amber-700 dark:text-amber-300 block truncate max-w-[150px]"
                          title={product.shipperTracking}
                        >
                          {product.shipperTracking}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="max-w-md">
                        <span className="font-semibold text-xs text-foreground line-clamp-1">
                          {product.description}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {product.orderNumber ? `Orden: ${product.orderNumber}` : ''}{' '}
                          {product.recipientName ? `• ${product.recipientName}` : ''}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="text-[10px] font-medium">
                        {product.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center">
                      <button
                        onClick={() => handleToggleShipperConfirmed(product)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                          product.shipperConfirmed
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40'
                            : 'bg-muted/50 text-muted-foreground border-border hover:border-slate-400'
                        }`}
                        title="Clic para cambiar estado de confirmación"
                      >
                        {product.shipperConfirmed ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Shiper OK</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>Pendiente</span>
                          </>
                        )}
                      </button>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {product.purchaseDate
                        ? new Date(product.purchaseDate).toLocaleDateString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                          })
                        : '—'}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(officialUrl, '_blank')}
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          title="Rastrear en web oficial de courier"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setViewMode('grid');
                            handleToggleTracking(product.id);
                          }}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Ver checkpoints paso a paso"
                        >
                          <Truck className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Dialog: Manual Checkpoint Entry ── */}
      <Dialog open={manualModalOpen} onOpenChange={setManualModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Agregar Checkpoint de Tracking</DialogTitle>
            <DialogDescription className="text-xs">
              Registra una actualización manual del courier o confirmación recibida por WhatsApp.
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-2 rounded bg-muted/40 border">
                <span className="font-bold text-foreground block">{selectedProduct.description}</span>
                <span className="font-mono text-muted-foreground text-[11px]">
                  Tracking: {selectedProduct.trackingNumber} ({selectedProduct.courier})
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Estado del Checkpoint</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Almacén Shiper OK">✓ Almacén Shiper OK (Confirmado)</SelectItem>
                    <SelectItem value="Pendiente en Shiper">⏳ Pendiente en Shiper</SelectItem>
                    <SelectItem value="Entregado en Miami">🏢 Entregado en Miami (Warehouse)</SelectItem>
                    <SelectItem value="En Reparto">🚚 En Reparto (Out for Delivery)</SelectItem>
                    <SelectItem value="En Tránsito">📦 En Tránsito Nacional</SelectItem>
                    <SelectItem value="Embarque Aéreo">✈️ Embarque Aéreo (Miami - Lima)</SelectItem>
                    <SelectItem value="Aduanas SUNAT Perú">🛃 Aduanas SUNAT Callao</SelectItem>
                    <SelectItem value="Entregado en Perú">🇵🇪 Entregado en Lima, Perú</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Ubicación / Ciudad</Label>
                <Input
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Ej: Shiper Miami (8298 NW 68th St), Miami, FL 33172"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Descripción del Evento</Label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Detalles del escaneo, número de guía o nota del courier..."
                  className="text-xs min-h-[60px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveManualCheckpoint}
              disabled={savingCheckpoint}
              className="text-xs font-bold bg-primary"
            >
              {savingCheckpoint ? 'Guardando...' : 'Guardar Checkpoint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
