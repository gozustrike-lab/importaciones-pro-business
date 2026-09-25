'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  ShoppingBag,
  Loader2,
  ExternalLink,
  DollarSign,
  Copy,
  Check,
  Calendar,
  Truck,
  Package,
  Layers,
  Sparkles,
  Plane,
  Building2,
  Tag,
  ShieldCheck,
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ShoppingCart,
  X,
  ArrowRight,
  History,
  FileSpreadsheet,
  CheckSquare,
  Square,
  RefreshCw,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchProducts, deleteProduct, createProduct, updateProduct, fetchNRUSStatus, archiveProduct } from '@/lib/api';
import type { Product, ProductFormData, NRUSStatus } from '@/lib/types';
import { ProductDialog } from './product-dialog';
import { EmbarqueDialog } from './embarque-dialog';
import { SyncHiddenDialog } from './sync-hidden-dialog';
import { ShipperVerifyDialog } from './shipper-verify-dialog';
import { useToast } from '@/hooks/use-toast';

// ── eBay Types ──
interface EbaySearchItem {
  itemId: string;
  title: string;
  price: { value: string; currency: string };
  image: string;
  condition: string;
  shippingCost: string;
  itemWebUrl: string;
  seller: {
    username: string;
    feedbackScore: number;
    feedbackPercentage: string;
  };
}

// ── Helpers ──
function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPurchaseDate(dateStr?: string) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getTrackingUrl(courier: string, trackingNumber: string) {
  if (!trackingNumber) return null;
  const c = (courier || '').toUpperCase();
  if (c.includes('USPS')) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
  if (c.includes('UPS')) return `https://www.ups.com/track?tracknum=${trackingNumber}`;
  if (c.includes('FEDEX')) return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  if (c.includes('DHL')) return `https://www.dhtml.com/en/express/tracking.html?AWB=${trackingNumber}`;
  return `https://www.google.com/search?q=${encodeURIComponent(`${courier} tracking ${trackingNumber}`)}`;
}

const statusConfig: Record<string, { label: string; badge: string; dot: string }> = {
  TRANSITO_USA: {
    label: '🚚 En Tránsito a Miami',
    badge: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800',
    dot: 'bg-sky-500',
  },
  USA: {
    label: '🏢 En Almacén Miami',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  'En Tránsito': {
    label: '✈️ En Vuelo a Lima',
    badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  Perú: {
    label: '🇵🇪 Stock en Lima',
    badge: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  Entregado: {
    label: '🇵🇪 Stock en Lima',
    badge: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800',
    dot: 'bg-purple-500',
  },
  Vendido: {
    label: '🤝 Vendido',
    badge: 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    dot: 'bg-zinc-500',
  },
};

function getImporterInfo(prod: Product) {
  const isPeggy =
    (prod.importerProfile || '').toLowerCase() === 'peggy' ||
    (prod.recipientName || '').toLowerCase().includes('peggy') ||
    (prod.recipientName || '').toLowerCase().includes('orduña');

  if (isPeggy) {
    return {
      key: 'peggy',
      name: 'Peggy Liliana',
      ruc: '10091870911',
      badge: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    };
  }
  return {
    key: 'fabio',
    name: 'Fabio César',
    ruc: '10762026835',
    badge: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  };
}

function getCourierBadge(courier: string) {
  const c = (courier || '').toUpperCase();
  if (c.includes('USPS')) return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400';
  if (c.includes('UPS')) return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400';
  if (c.includes('FEDEX')) return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400';
  return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300';
}

// ── eBay Category Options ──
const EBAY_CATEGORIES = [
  { id: '6000', label: 'iPads' },
  { id: '111422', label: 'MacBooks' },
  { id: '9355', label: 'iPhones' },
  { id: '178893', label: 'Smartwatches' },
  { id: '112532', label: 'AirPods / Accesorios' },
];

// ── eBay Sort Options ──
const EBAY_SORT_OPTIONS = [
  { value: 'price', label: 'Precio menor' },
  { value: 'price+desc', label: 'Precio mayor' },
  { value: 'relevance', label: 'Mejor match' },
  { value: 'newlyListed', label: 'Más recientes' },
];

export function ProductosTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [archivedProducts, setArchivedProducts] = useState<Product[]>([]);
  const [activeView, setActiveView] = useState<'active' | 'archived'>('active');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importerFilter, setImporterFilter] = useState<string>('all');
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close search suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── eBay Search State ──
  const [ebayDialogOpen, setEbayDialogOpen] = useState(false);
  const [ebayQuery, setEbayQuery] = useState('');
  const [ebayCategory, setEbayCategory] = useState('');
  const [ebaySort, setEbaySort] = useState('price');
  const [ebaySearching, setEbaySearching] = useState(false);
  const [ebayResults, setEbayResults] = useState<EbaySearchItem[]>([]);
  const [ebayImporting, setEbayImporting] = useState<string | null>(null);
  const [nrusStatus, setNrusStatus] = useState<NRUSStatus | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [activeData, archivedData, nrus] = await Promise.all([
        fetchProducts({ archived: 'false' }),
        fetchProducts({ archived: 'true' }),
        fetchNRUSStatus().catch(() => null),
      ]);
      setProducts(activeData);
      setArchivedProducts(archivedData);
      if (nrus) setNrusStatus(nrus);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los productos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const [refreshingStatus, setRefreshingStatus] = useState(false);

  // Auto-refresh every 30 minutes in background
  useEffect(() => {
    loadProducts();
    const interval = setInterval(() => {
      console.log('🔄 [Auto-sync 30min] Refrescando inventario y estados...');
      loadProducts();
    }, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadProducts]);

  const handleRefreshStatus = async () => {
    try {
      setRefreshingStatus(true);
      // Intentar sincronización en tiempo real directo con la API de eBay
      const syncRes = await fetch('/api/ebay/sync-live', { method: 'POST' }).catch(() => null);
      const syncData = syncRes && syncRes.ok ? await syncRes.json().catch(() => null) : null;

      await loadProducts();

      if (syncData?.success) {
        if (syncData.newlyDeliveredCount > 0) {
          toast({
            title: `🎉 ¡${syncData.newlyDeliveredCount} nuevo(s) paquete(s) en Miami!`,
            description: `Sincronizado en vivo con eBay. Total en Almacén Miami: ${syncData.inMiamiTotal}`,
          });
        } else {
          toast({
            title: '✅ Sincronizado en Vivo con eBay',
            description: syncData.message || `Todos los envíos al día (${syncData.inMiamiTotal} en Miami, ${syncData.inTransitTotal} en camino).`,
          });
        }
      } else if (syncData?.requiresAuth) {
        toast({
          title: '🔄 Inventario Local Actualizado',
          description: 'Tu sesión de eBay expiró. Usa "Sincronizar con eBay" para actualizar o reconectar.',
        });
      } else {
        toast({
          title: '🔄 Inventario Actualizado',
          description: `Se sincronizó el estado: ${counts.usa} en Almacén Miami, ${counts.transitoUsa} en camino.`,
        });
      }
    } catch {
      await loadProducts();
      toast({
        title: 'Inventario Actualizado',
        description: 'Se recargó la información local.',
      });
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleQuickMarkMiami = async (p: Product) => {
    try {
      const today = new Date().toISOString();
      await updateProduct(p.id, {
        status: 'USA',
        actualArrival: today,
      });
      toast({
        title: '🏢 Llegó al Almacén Miami',
        description: `Orden [${p.orderNumber}] marcada como entregada en Miami hoy.`,
      });
      await loadProducts();
    } catch (err: any) {
      toast({
        title: 'Error al actualizar',
        description: err.message || 'No se pudo actualizar el producto a Miami',
        variant: 'destructive',
      });
    }
  };

  const handleCopy = (text: string, id: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
    toast({ title: `${label} copiado`, description: text });
  };

  // Status counts for navigation pills
  const counts = useMemo(() => {
    return {
      all: products.length,
      transitoUsa: products.filter((p) => p.status === 'TRANSITO_USA').length,
      usa: products.filter((p) => p.status === 'USA').length,
      transito: products.filter((p) => p.status === 'En Tránsito').length,
      lima: products.filter((p) => p.status === 'Perú' || p.status === 'Entregado').length,
      vendido: products.filter((p) => p.status === 'Vendido').length,
      archived: archivedProducts.length,
    };
  }, [products, archivedProducts]);

  // Universal Filter helper applied to both active and archived lists
  const filterProductList = useCallback((list: Product[]) => {
    return list.filter((p) => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'Lima') {
          if (p.status !== 'Perú' && p.status !== 'Entregado') return false;
        } else if (p.status !== statusFilter) {
          return false;
        }
      }
      // Importer filter
      if (importerFilter !== 'all') {
        const isPeggy =
          (p.importerProfile || '').toLowerCase() === 'peggy' ||
          (p.recipientName || '').toLowerCase().includes('peggy') ||
          (p.recipientName || '').toLowerCase().includes('orduña');
        if (importerFilter === 'peggy' && !isPeggy) return false;
        if (importerFilter === 'fabio' && isPeggy) return false;
      }
      // Courier filter
      if (courierFilter !== 'all') {
        const c = (p.courier || '').toUpperCase();
        if (!c.includes(courierFilter.toUpperCase())) return false;
      }
      // Search: match title, orderNumber, tracking, courier, supplier, recipient, model, notes, itemId
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const match =
          (p.description || '').toLowerCase().includes(q) ||
          (p.orderNumber || '').toLowerCase().includes(q) ||
          (p.trackingNumber || '').toLowerCase().includes(q) ||
          (p.courier || '').toLowerCase().includes(q) ||
          (p.supplier || '').toLowerCase().includes(q) ||
          (p.recipientName || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.model || '').toLowerCase().includes(q) ||
          (p.notes || '').toLowerCase().includes(q) ||
          (p.itemId || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [statusFilter, importerFilter, courierFilter, search]);

  const filteredProducts = useMemo(() => filterProductList(products), [filterProductList, products]);
  const filteredArchivedProducts = useMemo(() => filterProductList(archivedProducts), [filterProductList, archivedProducts]);

  // ── Multi-selection & Embarque Documents ──
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [embarqueDialogOpen, setEmbarqueDialogOpen] = useState(false);
  const [syncHiddenOpen, setSyncHiddenOpen] = useState(false);
  const [shipperVerifyOpen, setShipperVerifyOpen] = useState(false);

  const currentList = activeView === 'active' ? filteredProducts : filteredArchivedProducts;
  const allCurrentSelected = currentList.length > 0 && currentList.every((p) => selectedIds.includes(p.id));

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (allCurrentSelected) {
      const currentIds = new Set(currentList.map((p) => p.id));
      setSelectedIds((prev) => prev.filter((id) => !currentIds.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...currentList.map((p) => p.id)]);
      setSelectedIds(Array.from(newIds));
    }
  }, [allCurrentSelected, currentList, selectedIds]);

  const handleOpenSingleEmbarque = useCallback((p: Product) => {
    setSelectedIds((prev) => (prev.includes(p.id) ? prev : [p.id]));
    setEmbarqueDialogOpen(true);
  }, []);

  const selectedProductsList = useMemo(() => {
    const all = [...products, ...archivedProducts];
    return all.filter((p) => selectedIds.includes(p.id));
  }, [products, archivedProducts, selectedIds]);

  const selectedFobTotal = useMemo(() => {
    return selectedProductsList.reduce((acc, p) => {
      const total = p.orderTotalUSD ?? (p.purchasePriceUSD + (p.shippingCostUSD || 0));
      return acc + total;
    }, 0);
  }, [selectedProductsList]);

  // Smart suggestions generator for the mini search box
  const searchSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const allCombined: Array<Product & { inArchived: boolean }> = [
      ...products.map(p => ({ ...p, inArchived: false })),
      ...archivedProducts.map(p => ({ ...p, inArchived: true })),
    ];

    if (!q) {
      // Default fast shortcuts when search box is empty
      return [
        { type: 'model', label: 'iPad Pro 10.5', value: 'iPad Pro 10.5', sub: 'Modelos de 10.5 pulgadas', inArchived: false },
        { type: 'model', label: 'MacBook Pro', value: 'MacBook Pro', sub: 'Laptops 13" y 16"', inArchived: false },
        { type: 'model', label: 'iPad (9th Gen)', value: 'iPad (9th Gen', sub: 'Tabletas 10.2 pulgadas', inArchived: false },
        { type: 'courier', label: 'UPS', value: 'UPS', sub: 'Envíos vía UPS', inArchived: false },
        { type: 'courier', label: 'USPS', value: 'USPS', sub: 'Envíos vía USPS', inArchived: false },
        { type: 'importer', label: 'Fabio César', value: 'Fabio', sub: 'RUC 10762026835', inArchived: false },
        { type: 'importer', label: 'Peggy Liliana', value: 'Peggy', sub: 'RUC 10091870911', inArchived: false },
      ];
    }

    const items: Array<{
      type: 'tracking' | 'order' | 'product';
      label: string;
      value: string;
      sub: string;
      inArchived: boolean;
    }> = [];
    const seen = new Set<string>();

    for (const p of allCombined) {
      // 1. Match Tracking (Highest priority)
      if (p.trackingNumber && p.trackingNumber.toLowerCase().includes(q)) {
        if (!seen.has(p.trackingNumber)) {
          seen.add(p.trackingNumber);
          items.push({
            type: 'tracking',
            label: p.trackingNumber,
            value: p.trackingNumber,
            sub: `${p.courier || 'Courier'} • ${p.description.slice(0, 32)}...`,
            inArchived: p.inArchived,
          });
        }
      }

      // 2. Match Order Number
      if (p.orderNumber && p.orderNumber.toLowerCase().includes(q)) {
        if (!seen.has(p.orderNumber)) {
          seen.add(p.orderNumber);
          items.push({
            type: 'order',
            label: `Orden ${p.orderNumber}`,
            value: p.orderNumber,
            sub: `${p.description.slice(0, 38)}...`,
            inArchived: p.inArchived,
          });
        }
      }

      // 3. Match Description
      if (p.description && p.description.toLowerCase().includes(q)) {
        const shortName = p.description.slice(0, 42);
        if (!seen.has(shortName)) {
          seen.add(shortName);
          items.push({
            type: 'product',
            label: shortName,
            value: p.description.slice(0, 30),
            sub: `Total: $${(p.orderTotalUSD ?? p.purchasePriceUSD).toFixed(2)} USD • ${p.status}`,
            inArchived: p.inArchived,
          });
        }
      }

      if (items.length >= 7) break;
    }

    return items;
  }, [search, products, archivedProducts]);

  const handleSave = async (data: ProductFormData) => {
    try {
      setSaving(true);
      if (editProduct) {
        await updateProduct(editProduct.id, data);
        toast({ title: 'Producto actualizado', description: 'Los cambios se guardaron correctamente.' });
      } else {
        await createProduct(data);
        toast({ title: 'Producto creado', description: 'El producto se agregó correctamente.' });
      }
      setDialogOpen(false);
      setEditProduct(null);
      await loadProducts();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el producto', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (id: string, archive: boolean) => {
    try {
      await archiveProduct(id, archive);
      toast({
        title: archive ? '📦 Producto Archivado' : '✅ Producto Restaurado',
        description: archive
          ? 'El producto se archivó como embarcado a Perú.'
          : 'El producto volvió al inventario activo.',
      });
      await loadProducts();
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar el estado del producto', variant: 'destructive' });
    }
  };

  const handleToggleShipperConfirmed = async (p: Product) => {
    const newStatus = !p.shipperConfirmed;
    try {
      // Optimistic update
      setProducts((prev) =>
        prev.map((item) =>
          item.id === p.id
            ? {
                ...item,
                shipperConfirmed: newStatus,
                status: newStatus && item.status === 'TRANSITO_USA' ? 'USA' : item.status,
              }
            : item
        )
      );

      const payload: any = { shipperConfirmed: newStatus };
      if (newStatus && p.status === 'TRANSITO_USA') {
        payload.status = 'USA';
        payload.actualArrival = new Date().toISOString();
      }

      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error al actualizar');

      toast({
        title: newStatus ? '✅ Almacén Shiper OK' : '⏳ Marcado como Pendiente Shiper',
        description: `Producto ${p.orderNumber || ''} actualizado en el sistema.`,
      });
      await loadProducts();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado de Shiper',
        variant: 'destructive',
      });
      await loadProducts();
    }
  };

  // ── eBay Search Handler ──
  const handleEbaySearch = async () => {
    if (!ebayQuery.trim()) {
      toast({ title: 'Campo requerido', description: 'Ingresa un término de búsqueda' });
      return;
    }

    try {
      setEbaySearching(true);
      setEbayResults([]);

      const params = new URLSearchParams();
      params.set('q', ebayQuery.trim());
      if (ebayCategory && ebayCategory !== 'all') params.set('category_id', ebayCategory);
      if (ebaySort) params.set('sort', ebaySort);
      params.set('limit', '20');

      const response = await fetch(`/api/ebay/search?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la búsqueda');
      }

      setEbayResults(data.items || []);
      if (data.items?.length === 0) {
        toast({ title: 'Sin resultados', description: 'No se encontraron productos en eBay' });
      }
    } catch (error) {
      console.error('eBay search error:', error);
      toast({
        title: 'Búsqueda de eBay',
        description: error instanceof Error ? error.message : 'No se pudo conectar con eBay.',
      });
    } finally {
      setEbaySearching(false);
    }
  };

  // ── eBay Import Handler ──
  const handleEbayImport = async (item: EbaySearchItem) => {
    try {
      setEbayImporting(item.itemId);
      toast({ title: 'Importando...', description: `Importando ${item.title}` });

      const productData: ProductFormData = {
        description: item.title,
        category: guessCategory(ebayCategory === 'all' ? '' : ebayCategory),
        grade: 'A',
        condition: item.condition || 'Used',
        status: 'USA',
        supplier: 'eBay',
        courier: '',
        trackingNumber: '',
        estimatedArrival: '',
        screenOk: false,
        touchOk: false,
        speakersOk: false,
        microphoneOk: false,
        wifiOk: false,
        bluetoothOk: false,
        camerasOk: false,
        portsOk: false,
        buttonsOk: false,
        keyboardOk: false,
        trackpadOk: false,
        chassisOk: false,
        batteryOk: false,
        chargerIncluded: false,
        originalBox: false,
        batteryCycles: null,
        purchasePriceUSD: parseFloat(item.price.value) || 0,
        shippingCostUSD: parseFloat(item.shippingCost) || 0,
        advertisingCostUSD: 0,
        extraCostsUSD: 0,
        exchangeRate: 3.4,
        salePricePEN: 0,
      };

      await createProduct(productData);
      toast({ title: 'Producto importado', description: `"${item.title}" se agregó al inventario.` });
      await loadProducts();
    } catch (error) {
      console.error('eBay import error:', error);
      toast({
        title: 'Error al importar',
        description: error instanceof Error ? error.message : 'No se pudo importar el producto',
        variant: 'destructive',
      });
    } finally {
      setEbayImporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Inventario & Importaciones</h2>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400">
              Live eBay
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Trazabilidad de compras eBay, casillero Miami de Shipper y stock disponible en Lima
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* View Toggle: Active / Archived */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setActiveView('active')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
                activeView === 'active'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-card text-muted-foreground hover:bg-accent'
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              Activos
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${activeView === 'active' ? 'bg-white/25' : 'bg-muted'}`}>
                {counts.all}
              </span>
            </button>
            <button
              onClick={() => setActiveView('archived')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-l border-border transition-colors ${
                activeView === 'archived'
                  ? 'bg-slate-600 text-white'
                  : 'bg-card text-muted-foreground hover:bg-accent'
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              Archivados
              {counts.archived > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${activeView === 'archived' ? 'bg-white/25' : 'bg-amber-100 text-amber-800'}`}>
                  {counts.archived}
                </span>
              )}
            </button>
          </div>

          <Button
            onClick={() => setEmbarqueDialogOpen(true)}
            variant="outline"
            className="gap-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 min-h-[40px] font-semibold"
            title="Generar Hoja de Embarque y Hoja de Traducción SUNAT para los productos seleccionados"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Embarque & Traducción</span>
            {selectedIds.length > 0 && (
              <Badge className="bg-emerald-600 text-white ml-0.5 px-1.5 py-0 text-[10px] font-bold">
                {selectedIds.length}
              </Badge>
            )}
          </Button>

          <Button
            onClick={handleRefreshStatus}
            disabled={refreshingStatus || loading}
            variant="outline"
            className="gap-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 min-h-[40px] font-semibold"
            title="Actualizar estado de envíos y paquetes en Miami (Auto cada 30 min o manual)"
          >
            <RefreshCw className={`h-4 w-4 text-emerald-600 ${refreshingStatus ? 'animate-spin' : ''}`} />
            <span>Actualizar Estados</span>
          </Button>

          <Button
            onClick={() => setSyncHiddenOpen(true)}
            variant="outline"
            className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 min-h-[40px] font-semibold"
            title="Sincronizar paquetes llegados a Miami o compras ocultas de eBay con 1 clic o marcador de Chrome"
          >
            <Building2 className="h-4 w-4 text-emerald-600" />
            <span>Sincronizar con eBay</span>
          </Button>

          <Button
            onClick={() => setShipperVerifyOpen(true)}
            variant="outline"
            className="gap-2 border-emerald-400 text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 min-h-[40px] font-semibold"
            title="Copiar lista de trackings para WhatsApp o validar la respuesta de Shiper Courier"
          >
            <Building2 className="h-4 w-4 text-emerald-600" />
            <span>Validar con Shiper</span>
          </Button>

          <Button
            onClick={() => setEbayDialogOpen(true)}
            variant="outline"
            className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/40 min-h-[40px]"
          >
            <ShoppingBag className="h-4 w-4 text-orange-600" />
            Buscar en eBay
          </Button>
          <Button
            onClick={() => {
              setEditProduct(null);
              setDialogOpen(true);
            }}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[40px]"
          >
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SUNAT NRUS PURCHASE LIMIT ALERT & RECOMMENDATION BANNER       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {nrusStatus?.recommendation && (
        <Card
          className={`border overflow-hidden shadow-sm transition-all ${
            nrusStatus.recommendation.severity === 'critical'
              ? 'border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/25'
              : nrusStatus.recommendation.severity === 'warning'
              ? 'border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/25'
              : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
          }`}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    nrusStatus.recommendation.severity === 'critical'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                      : nrusStatus.recommendation.severity === 'warning'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
                  }`}
                >
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm sm:text-base text-foreground">
                      {nrusStatus.recommendation.title}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-semibold ${
                        nrusStatus.recommendation.severity === 'critical'
                          ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300'
                          : nrusStatus.recommendation.severity === 'warning'
                          ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      Límite RUS: S/ 8,000 / mes
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {nrusStatus.recommendation.description}
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-foreground pt-0.5">
                    👉 {nrusStatus.recommendation.actionBanner}
                  </p>
                </div>
              </div>

              {/* Action Button: Copy Recommended RUC */}
              {nrusStatus.recommendation.targetRuc && (
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                  <Button
                    onClick={() => {
                      if (!nrusStatus.recommendation) return;
                      navigator.clipboard.writeText(nrusStatus.recommendation.targetRuc);
                      toast({
                        title: 'RUC Copiado para Compras',
                        description: `RUC ${nrusStatus.recommendation.targetRuc} (${nrusStatus.recommendation.targetName}) listo para usar en eBay/Shipper.`,
                      });
                    }}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 shadow-sm"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar RUC {nrusStatus.recommendation.target === 'fabio' ? 'Fabio' : 'Peggy'} ({nrusStatus.recommendation.targetRuc})
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Status Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
            statusFilter === 'all'
              ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900'
              : 'bg-card text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          <span>Todos</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'all' ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' : 'bg-muted text-foreground'}`}>
            {counts.all}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('TRANSITO_USA')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
            statusFilter === 'TRANSITO_USA'
              ? 'bg-sky-600 text-white border-sky-600'
              : 'bg-card text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-sky-400 shrink-0" />
          <span>🚚 En Tránsito a Miami</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'TRANSITO_USA' ? 'bg-white/20 text-white' : 'bg-muted text-foreground'}`}>
            {counts.transitoUsa}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('USA')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
            statusFilter === 'USA'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-card text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <span>🏢 En Almacén Miami</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'USA' ? 'bg-white/20 text-white' : 'bg-muted text-foreground'}`}>
            {counts.usa}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('En Tránsito')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
            statusFilter === 'En Tránsito'
              ? 'bg-amber-600 text-white border-amber-600'
              : 'bg-card text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
          <span>✈️ En Vuelo a Lima</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'En Tránsito' ? 'bg-white/20 text-white' : 'bg-muted text-foreground'}`}>
            {counts.transito}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('Lima')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
            statusFilter === 'Lima'
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-card text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-purple-400 shrink-0" />
          <span>🇵🇪 Stock en Lima</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'Lima' ? 'bg-white/20 text-white' : 'bg-muted text-foreground'}`}>
            {counts.lima}
          </span>
        </button>

        <button
          onClick={() => setStatusFilter('Vendido')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
            statusFilter === 'Vendido'
              ? 'bg-zinc-700 text-white border-zinc-700'
              : 'bg-card text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-zinc-400 shrink-0" />
          <span>🤝 Vendidos</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === 'Vendido' ? 'bg-white/20 text-white' : 'bg-muted text-foreground'}`}>
            {counts.vendido}
          </span>
        </button>
      </div>

      {/* Filter Controls Card */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input with Mini Suggestions Dropdown */}
            <div className="space-y-1.5 lg:col-span-2 relative" ref={searchContainerRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Buscar compra / producto</label>
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setShowSuggestions(false);
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
                  >
                    <X className="h-3 w-3" /> Limpiar filtro
                  </button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descripción, orden #, tracking, courier, titular..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="pl-9 pr-8 h-9 text-sm"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setShowSuggestions(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Borrar texto"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Mini Cuadro de Sugerencias y Autocompletado */}
              {showSuggestions && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border/80 bg-popover text-popover-foreground shadow-xl overflow-hidden backdrop-blur-md animate-in fade-in-0 zoom-in-95">
                  <div className="p-2 border-b border-border/50 bg-muted/40 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      {search ? 'Coincidencias encontradas' : 'Sugerencias rápidas'}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {searchSuggestions.length} opciones
                    </span>
                  </div>

                  <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-1">
                    {searchSuggestions.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No hay coincidencias para &quot;{search}&quot;
                      </div>
                    ) : (
                      searchSuggestions.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            setSearch(sug.value);
                            setShowSuggestions(false);
                            if (sug.inArchived && activeView === 'active') {
                              setActiveView('archived');
                              toast({
                                title: '📦 Producto Archivado',
                                description: 'Cambiado automáticamente a la vista de Archivados.',
                              });
                            } else if (!sug.inArchived && activeView === 'archived') {
                              setActiveView('active');
                            }
                          }}
                          className="w-full text-left flex items-center justify-between p-2 rounded-lg hover:bg-accent/80 transition-colors text-xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="p-1.5 rounded-md bg-muted group-hover:bg-background shrink-0 text-muted-foreground group-hover:text-foreground">
                              {sug.type === 'tracking' && <Truck className="h-3.5 w-3.5 text-blue-500" />}
                              {sug.type === 'order' && <ShoppingCart className="h-3.5 w-3.5 text-emerald-500" />}
                              {sug.type === 'product' && <Package className="h-3.5 w-3.5 text-purple-500" />}
                              {sug.type === 'model' && <Sparkles className="h-3.5 w-3.5 text-amber-500" />}
                              {sug.type === 'courier' && <Truck className="h-3.5 w-3.5 text-sky-500" />}
                              {sug.type === 'importer' && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate group-hover:text-primary">
                                {sug.label}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {sug.sub}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {sug.inArchived ? (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300">
                                Archivado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300">
                                Activo
                              </Badge>
                            )}
                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Importer Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Titular SUNAT</label>
              <Select value={importerFilter} onValueChange={setImporterFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos los titulares" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Titulares</SelectItem>
                  <SelectItem value="fabio">Fabio César (10762026835)</SelectItem>
                  <SelectItem value="peggy">Peggy Liliana (10091870911)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Courier Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Courier USA</label>
              <Select value={courierFilter} onValueChange={setCourierFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Todos los couriers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Couriers</SelectItem>
                  <SelectItem value="USPS">USPS</SelectItem>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="FEDEX">FedEx</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── CROSS-VIEW SEARCH NOTIFICATION ─── */}
      {search.trim() && activeView === 'active' && filteredProducts.length === 0 && filteredArchivedProducts.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              No hay coincidencias en inventario activo, pero se encontró <strong>{filteredArchivedProducts.length} producto{filteredArchivedProducts.length !== 1 ? 's' : ''}</strong> con &quot;{search}&quot; en <strong>Productos Archivados</strong>.
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setActiveView('archived');
              setShowSuggestions(false);
            }}
            className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shrink-0"
          >
            Ver en Archivados ({filteredArchivedProducts.length}) <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {search.trim() && activeView === 'archived' && filteredArchivedProducts.length === 0 && filteredProducts.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 text-xs">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              No hay coincidencias en archivados, pero se encontró <strong>{filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}</strong> con &quot;{search}&quot; en <strong>Inventario Activo</strong>.
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setActiveView('active');
              setShowSuggestions(false);
            }}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0"
          >
            Ver en Activos ({filteredProducts.length}) <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* ─── SUMMARY COUNTER BAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {activeView === 'active' ? 'Artículos en Inventario Activo:' : 'Artículos Ocultos / Archivados:'}
          </span>
          <Badge
            variant="outline"
            className={`font-mono text-xs font-bold px-2 py-0.5 ${
              activeView === 'active'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
            }`}
          >
            {activeView === 'active' ? `${filteredProducts.length} de ${counts.all}` : `${filteredArchivedProducts.length} de ${counts.archived}`}
          </Badge>
          {((activeView === 'active' && filteredProducts.length !== products.length) || (activeView === 'archived' && filteredArchivedProducts.length !== archivedProducts.length)) && (
            <span className="text-[11px] text-muted-foreground italic">
              (filtrados por búsqueda / estado)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono self-start sm:self-auto">
          <span>Inversión Total:</span>
          <strong className="text-foreground font-bold">
            ${(
              (activeView === 'active' ? filteredProducts : filteredArchivedProducts).reduce(
                (acc, cur) => acc + (cur.orderTotalUSD ?? (cur.purchasePriceUSD + (cur.shippingCostUSD || 0))),
                0
              )
            ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </strong>
          <span>•</span>
          <strong className="text-emerald-600 font-bold">
            {formatPEN(
              (activeView === 'active' ? filteredProducts : filteredArchivedProducts).reduce(
                (acc, cur) => acc + (cur.orderTotalUSD ?? (cur.purchasePriceUSD + (cur.shippingCostUSD || 0))),
                0
              ) * 3.40
            )}
          </strong>
        </div>
      </div>

      {/* ─── MOBILE ARCHIVED BANNER ─── */}
      {activeView === 'archived' && (
        <div className="block md:hidden p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40 space-y-1">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
              📦 Ocultos / Archivados (Embarcados a Perú)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Productos archivados en eBay porque ya se embarcaron hacia Lima ({counts.archived} total).
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MOBILE-FIRST CARDS VIEW (Dispositivos Móviles < md)           */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-12 w-full" />
            </Card>
          ))
        ) : (activeView === 'active' ? filteredProducts : filteredArchivedProducts).length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            {activeView === 'archived' ? (
              <>
                <Archive className="h-10 w-10 mx-auto mb-2 opacity-30 text-slate-500" />
                <p className="font-medium text-sm">Sin productos archivados</p>
                <p className="text-xs text-muted-foreground mt-1">Los productos embarcados a Perú aparecerán aquí</p>
              </>
            ) : (
              <>
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium text-sm">No se encontraron productos</p>
                <p className="text-xs text-muted-foreground mt-1">Intenta ajustar los filtros de búsqueda</p>
              </>
            )}
          </Card>
        ) : (
          (activeView === 'active' ? filteredProducts : filteredArchivedProducts).map((p, idx) => {
            const imp = getImporterInfo(p);
            const st = statusConfig[p.status] || statusConfig.USA;
            const trackUrl = getTrackingUrl(p.courier, p.trackingNumber);
            const ebayItemUrl =
              p.itemUrl ||
              (p.itemId ? `https://www.ebay.com/itm/${p.itemId}` : null);
            const ebayOrderUrl =
              p.orderUrl ||
              (p.orderNumber ? `https://order.ebay.com/ord/show?orderId=${p.orderNumber}` : null);
            const ebayPrimaryUrl = ebayItemUrl || ebayOrderUrl;
            const orderTotal = p.orderTotalUSD ?? (p.purchasePriceUSD + (p.shippingCostUSD || 0));
            const orderTotalPEN = orderTotal * 3.40;

            return (
              <Card key={p.id} className={`border-border/70 shadow-sm overflow-hidden ${p.isArchived ? 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-300 dark:border-slate-700' : ''}`}>
                <CardContent className="p-4 space-y-3">
                  {/* Top Badges & eBay Links */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSelect(p.id)}
                        className="p-1 rounded hover:bg-muted transition-colors shrink-0"
                        title={selectedIds.includes(p.id) ? "Deseleccionar" : "Seleccionar"}
                      >
                        {selectedIds.includes(p.id) ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground/60" />
                        )}
                      </button>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={`gap-1 text-[11px] font-medium ${st.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[11px] font-medium ${imp.badge}`}>
                          {imp.name}
                        </Badge>
                        {p.isArchived && (
                          <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300">
                            Archivado
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {ebayPrimaryUrl && (
                        <a
                          href={ebayPrimaryUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 dark:bg-orange-950/40 px-2 py-1 rounded-md border border-orange-200 dark:border-orange-800 transition-colors"
                          title="Abrir publicación en eBay"
                        >
                          <ExternalLink className="h-3 w-3" />
                          eBay
                        </a>
                      )}
                      {ebayOrderUrl && ebayItemUrl && (
                        <a
                          href={ebayOrderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/60 px-1.5 py-1 rounded border border-border/60 transition-colors"
                          title="Ver recibo de orden en eBay"
                        >
                          Recibo
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Title & Order Total with Numbering Badge */}
                  <div>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 inline-flex items-center justify-center min-w-[26px] h-5 px-1.5 rounded-md bg-muted font-mono text-[11px] font-bold text-foreground border border-border/60 mt-0.5">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                        {p.description}
                      </h3>
                    </div>

                    {/* Order Total Badge */}
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-semibold">
                      <ShoppingCart className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Order Total: ${orderTotal.toFixed(2)} USD</span>
                      <span className="text-emerald-500/60 font-normal">•</span>
                      <span>{formatPEN(orderTotalPEN)}</span>
                    </div>

                    {/* Cantidad & Modelo Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
                        p.quantity > 1 
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200' 
                          : 'bg-muted text-muted-foreground border border-border/50'
                      }`}>
                        <Package className="h-3 w-3" />
                        {p.quantity > 1 ? `x${p.quantity} unids` : `1 unid`}
                      </span>

                      <button
                        onClick={() => handleOpenSingleEmbarque(p)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
                          p.model
                            ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                        }`}
                        title={p.model ? "Modelo técnico registrado. Clic para editar." : "Falta ingresar modelo técnico para aduanas. Clic para ingresar."}
                      >
                        <span>Mod: {p.model || 'Sin modelo'}</span>
                        <Pencil className="h-2.5 w-2.5 opacity-60" />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground/70" />
                        <span>Comprado: {formatPurchaseDate(p.purchaseDate || p.createdAt)}</span>
                      </div>
                      {p.status === 'USA' && p.actualDeliveryDate && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800">
                          <Check className="h-3 w-3" />
                          Entregado en Miami: {formatPurchaseDate(p.actualDeliveryDate)}
                        </span>
                      )}
                      {p.status === 'USA' && (
                        <div className="inline-flex items-center gap-1">
                          {p.shipperConfirmed ? (
                            <button
                              onClick={() => handleToggleShipperConfirmed(p)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 hover:bg-amber-100 text-emerald-800 hover:text-amber-900 border border-emerald-300 transition-colors cursor-pointer"
                              title="Confirmado por Shiper Miami. Clic para cambiar a Pendiente."
                            >
                              <Check className="h-2.5 w-2.5 text-emerald-600" />
                              Almacén Shiper OK
                            </button>
                          ) : (
                            <div className="inline-flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-300">
                                ⏳ Pendiente Shiper
                              </span>
                              <button
                                onClick={() => handleToggleShipperConfirmed(p)}
                                className="h-4.5 px-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold inline-flex items-center gap-0.5 transition-colors cursor-pointer"
                                title="Marcar Almacén Shiper OK con 1 clic"
                              >
                                <Check className="h-2.5 w-2.5" />
                                OK
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {p.status === 'TRANSITO_USA' && (
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                          <Truck className="h-3 w-3" />
                          <span>Rumbo a Miami</span>
                          <button
                            onClick={() => handleQuickMarkMiami(p)}
                            className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] shadow-xs cursor-pointer"
                            title="Marcar como entregado en Almacén Miami hoy"
                          >
                            <Building2 className="h-2.5 w-2.5" />
                            Llegó a Miami
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order & Tracking Grid */}
                  <div className="grid grid-cols-1 gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
                    {/* Order # */}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Orden:</span>
                      <div className="flex items-center gap-1.5 font-mono font-medium">
                        <span>{p.orderNumber || '-'}</span>
                        {p.orderNumber && (
                          <button
                            onClick={() => handleCopy(p.orderNumber, `ord-${p.id}`, 'N° de Orden')}
                            className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                            title="Copiar orden"
                          >
                            {copiedId === `ord-${p.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Tracking */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getCourierBadge(p.courier)}`}>
                          {p.courier || 'Courier'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono font-medium">
                        {p.trackingNumber ? (
                          <>
                            {trackUrl ? (
                              <a
                                href={trackUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline flex items-center gap-1"
                              >
                                {p.trackingNumber}
                                <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                              </a>
                            ) : (
                              <span>{p.trackingNumber}</span>
                            )}
                            <button
                              onClick={() => handleCopy(p.trackingNumber, `tr-${p.id}`, 'Tracking')}
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                              title="Copiar tracking"
                            >
                              {copiedId === `tr-${p.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </>
                        ) : (
                          <span className="text-muted-foreground italic">Sin tracking</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price & Actions Row */}
                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Order Total:</p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-foreground">
                          ${orderTotal.toFixed(2)}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          ({formatPEN(orderTotalPEN)})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                        onClick={() => handleOpenSingleEmbarque(p)}
                        title="Embarque & Traducción"
                      >
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => setViewProduct(p)}
                        title="Ver detalle"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditProduct(p);
                          setDialogOpen(true);
                        }}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {p.isArchived ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => handleArchive(p.id, false)}
                          title="Restaurar al inventario activo"
                        >
                          <ArchiveRestore className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          onClick={() => handleArchive(p.id, true)}
                          title="Archivar (embarcado a Perú)"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* DESKTOP TABLE VIEW (Pantallas Grandes >= md)                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}

      {/* ─── ARCHIVED PANEL BANNER ─── */}
      {activeView === 'archived' && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/40">
          <div className="p-2.5 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0">
            <Archive className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
              📦 Productos Archivados — Ya Embarcados a Perú
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estos productos fueron archivados en eBay (Show hidden) porque ya se embarcaron a Lima. Puedes restaurarlos si es necesario.
            </p>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0 bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300">
            {counts.archived} productos
          </Badge>
        </div>
      )}

      <Card className={`hidden md:block border-border/60 shadow-sm overflow-hidden ${activeView === 'archived' ? 'border-slate-300 dark:border-slate-700' : ''}`}>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (activeView === 'active' ? filteredProducts : filteredArchivedProducts).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              {activeView === 'archived' ? (
                <>
                  <Archive className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-base font-semibold">Sin productos archivados</p>
                  <p className="text-xs text-muted-foreground">Los productos embarcados a Perú aparecerán aquí</p>
                </>
              ) : (
                <>
                  <Package className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-base font-semibold">No se encontraron productos</p>
                  <p className="text-xs text-muted-foreground">Intenta ajustar los filtros de búsqueda o estado</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <Table className="w-full">
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="w-[42px] px-2 text-center">
                      <button
                        onClick={handleToggleSelectAll}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title={allCurrentSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                      >
                        {allCurrentSelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-[38%] min-w-[300px]">Artículo / Compra eBay</TableHead>
                    <TableHead className="w-[18%] min-w-[170px]">Courier & Tracking USA</TableHead>
                    <TableHead className="w-[14%] min-w-[130px]">Titular SUNAT</TableHead>
                    <TableHead className="w-[12%] min-w-[110px]">Ubicación</TableHead>
                    <TableHead className="w-[10%] text-right min-w-[110px]">
                      <span className="flex items-center justify-end gap-1">
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Order Total
                      </span>
                    </TableHead>
                    <TableHead className="w-[8%] text-right min-w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(activeView === 'active' ? filteredProducts : filteredArchivedProducts).map((p, idx) => {
                    const imp = getImporterInfo(p);
                    const st = statusConfig[p.status] || statusConfig.USA;
                    const trackUrl = getTrackingUrl(p.courier, p.trackingNumber);
                    const ebayItemUrl =
                      p.itemUrl ||
                      (p.itemId ? `https://www.ebay.com/itm/${p.itemId}` : null);
                    const ebayOrderUrl =
                      p.orderUrl ||
                      (p.orderNumber ? `https://order.ebay.com/ord/show?orderId=${p.orderNumber}` : null);
                    const ebayPrimaryUrl = ebayItemUrl || ebayOrderUrl;
                    // Order Total = item + shipping (what was actually paid to eBay)
                    const orderTotal = p.orderTotalUSD ?? (p.purchasePriceUSD + (p.shippingCostUSD || 0));
                    const orderTotalPEN = orderTotal * 3.40;

                    return (
                      <TableRow key={p.id} className={`hover:bg-muted/30 transition-colors ${selectedIds.includes(p.id) ? 'bg-emerald-50/50 dark:bg-emerald-950/25' : ''} ${p.isArchived ? 'opacity-75 bg-slate-50/50 dark:bg-slate-950/30' : ''}`}>
                        {/* Checkbox Col */}
                        <TableCell className="align-top py-3 px-2 text-center">
                          <button
                            onClick={() => handleToggleSelect(p.id)}
                            className="p-1 rounded hover:bg-muted transition-colors mt-0.5"
                            title={selectedIds.includes(p.id) ? "Deseleccionar" : "Seleccionar para embarque"}
                          >
                            {selectedIds.includes(p.id) ? (
                              <CheckSquare className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground/60 hover:text-foreground" />
                            )}
                          </button>
                        </TableCell>
                        {/* Title & Order & Date & Real eBay Price */}
                        <TableCell className="align-top py-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2.5">
                                <span className="shrink-0 inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md bg-muted font-mono text-xs font-bold text-foreground border border-border/60 mt-0.5">
                                  #{String(idx + 1).padStart(2, '0')}
                                </span>
                                <span className="font-semibold text-foreground text-sm line-clamp-2 leading-snug pt-0.5" title={p.description}>
                                  {p.description}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {ebayPrimaryUrl && (
                                  <a
                                    href={ebayPrimaryUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700 bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 dark:hover:bg-orange-900/40 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800 transition-colors"
                                    title="Ver publicación original en eBay (fotos y detalles)"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    eBay
                                  </a>
                                )}
                                {ebayOrderUrl && ebayItemUrl && (
                                  <a
                                    href={ebayOrderUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-1.5 py-0.5 rounded border border-border/60 transition-colors"
                                    title="Ver recibo de orden en eBay"
                                  >
                                    Recibo
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Badge Order Total eBay + Order # + Fecha */}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              {/* Order Total Badge */}
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-semibold">
                                <ShoppingCart className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Order Total: ${orderTotal.toFixed(2)} USD</span>
                                <span className="text-emerald-500/60 font-normal">|</span>
                                <span>{formatPEN(orderTotalPEN)}</span>
                              </div>

                              {/* Cantidad Badge */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                                p.quantity > 1
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                                  : 'bg-muted/80 text-muted-foreground border border-border/50'
                              }`}>
                                <Package className="h-3 w-3 shrink-0" />
                                <span>{p.quantity > 1 ? `x${p.quantity} unids` : '1 unid'}</span>
                              </span>

                              {/* Technical Model Badge - Click to open Embarque dialog or edit */}
                              <button
                                onClick={() => handleOpenSingleEmbarque(p)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-medium transition-colors ${
                                  p.model
                                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100'
                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-100'
                                }`}
                                title={p.model ? "Modelo técnico registrado. Clic para editar." : "Falta ingresar modelo técnico para aduanas. Clic para ingresar."}
                              >
                                <span>Mod: {p.model || 'Sin modelo'}</span>
                                <Pencil className="h-2.5 w-2.5 opacity-60" />
                              </button>

                              {/* Order Number */}
                              {p.orderNumber && (
                                <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded border border-border/40">
                                  <span className="text-[11px] text-muted-foreground/70">Ord:</span>
                                  <span className="font-medium text-foreground">{p.orderNumber}</span>
                                  <button
                                    onClick={() => handleCopy(p.orderNumber, `ord-d-${p.id}`, 'N° de Orden')}
                                    className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                    title="Copiar orden"
                                  >
                                    {copiedId === `ord-d-${p.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                  </button>
                                </div>
                              )}

                              {/* Purchase Date */}
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 text-muted-foreground/70" />
                                <span>{formatPurchaseDate(p.purchaseDate || p.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Courier & Tracking */}
                        <TableCell className="align-top py-3">
                          <div className="space-y-1">
                            <Badge variant="outline" className={`text-xs px-2 py-0.5 ${getCourierBadge(p.courier)}`}>
                              {p.courier || 'USPS'}
                            </Badge>

                            {p.trackingNumber ? (
                              <div className="flex items-center gap-1.5 font-mono text-xs pt-0.5">
                                {trackUrl ? (
                                  <a
                                    href={trackUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1 font-medium truncate max-w-[150px]"
                                    title={`Rastrear en ${p.courier}`}
                                  >
                                    {p.trackingNumber}
                                    <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                  </a>
                                ) : (
                                  <span className="font-medium truncate max-w-[150px]">{p.trackingNumber}</span>
                                )}
                                <button
                                  onClick={() => handleCopy(p.trackingNumber, `tr-d-${p.id}`, 'Tracking')}
                                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground shrink-0"
                                  title="Copiar tracking"
                                >
                                  {copiedId === `tr-d-${p.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic pt-0.5">Sin tracking</p>
                            )}
                          </div>
                        </TableCell>

                        {/* Importer Profile */}
                        <TableCell className="align-top py-3">
                          <div className="space-y-0.5">
                            <Badge variant="outline" className={`text-xs font-semibold ${imp.badge}`}>
                              {imp.name}
                            </Badge>
                            <p className="text-[11px] font-mono text-muted-foreground pt-0.5">
                              RUC: {imp.ruc}
                            </p>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="align-top py-3">
                          <div className="space-y-1">
                            <Badge variant="outline" className={`gap-1.5 text-xs font-medium ${st.badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                              {st.label}
                            </Badge>
                            {p.status === 'USA' && p.actualDeliveryDate && (
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                {formatPurchaseDate(p.actualDeliveryDate)}
                              </p>
                            )}
                            {p.status === 'USA' && (
                              <div className="pt-0.5">
                                {p.shipperConfirmed ? (
                                  <button
                                    onClick={() => handleToggleShipperConfirmed(p)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 hover:bg-amber-100 text-emerald-800 hover:text-amber-900 border border-emerald-300 hover:border-amber-300 transition-colors cursor-pointer group shadow-2xs"
                                    title="Confirmado por Shiper Miami. Clic para cambiar a Pendiente."
                                  >
                                    <Check className="h-2.5 w-2.5 text-emerald-600 group-hover:hidden" />
                                    <span className="group-hover:hidden">Almacén Shiper OK</span>
                                    <span className="hidden group-hover:inline">⚠️ Cambiar a Pendiente</span>
                                  </button>
                                ) : (
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      onClick={() => handleToggleShipperConfirmed(p)}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 hover:bg-emerald-50 text-amber-800 hover:text-emerald-800 border border-amber-300 hover:border-emerald-400 transition-colors cursor-pointer"
                                      title="Clic para marcar como Almacén Shiper OK"
                                    >
                                      ⏳ Pendiente Shiper
                                    </button>
                                    <button
                                      onClick={() => handleToggleShipperConfirmed(p)}
                                      className="h-5 px-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-0.5 transition-colors shadow-2xs cursor-pointer"
                                      title="Marcar Almacén Shiper OK con 1 clic"
                                    >
                                      <Check className="h-2.5 w-2.5" />
                                      OK
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            {p.status === 'TRANSITO_USA' && (
                              <div className="space-y-1.5 pt-0.5">
                                <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium flex items-center gap-1">
                                  <Truck className="h-3 w-3" />
                                  En camino a Miami
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-5 px-1.5 text-[10px] font-semibold gap-1 bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                  onClick={() => handleQuickMarkMiami(p)}
                                  title="Marcar como entregado en Almacén Miami hoy"
                                >
                                  <Building2 className="h-2.5 w-2.5 text-emerald-600" />
                                  Llegó a Miami
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Order Total USD & PEN */}
                        <TableCell className="align-top py-3 text-right">
                          <div>
                            <p className="font-bold text-sm text-foreground">
                              ${orderTotal.toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatPEN(orderTotalPEN)}
                            </p>
                            {p.shippingCostUSD > 0 && (
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                                Ítem ${p.purchasePriceUSD.toFixed(2)} + Env ${p.shippingCostUSD.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="align-top py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
                              onClick={() => handleOpenSingleEmbarque(p)}
                              title="Generar Hoja de Embarque y Traducción de este producto"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="hidden xl:inline">Embarque</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => setViewProduct(p)}
                              title="Ver Detalle"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditProduct(p);
                                setDialogOpen(true);
                              }}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {p.isArchived ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleArchive(p.id, false)}
                                title="Restaurar al inventario activo"
                              >
                                <ArchiveRestore className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                onClick={() => handleArchive(p.id, true)}
                                title="Archivar (marcar como embarcado a Perú)"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Edit / Create Dialog */}
      <ProductDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditProduct(null);
        }}
        product={editProduct}
        onSave={handleSave}
        loading={saving}
      />


      {/* View Product Dialog */}
      <Dialog open={!!viewProduct} onOpenChange={() => setViewProduct(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span>Detalle de la Compra</span>
              {viewProduct && (
                <Badge variant="outline" className={statusConfig[viewProduct.status]?.badge || ''}>
                  {statusConfig[viewProduct.status]?.label || viewProduct.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewProduct && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Descripción:</p>
                <p className="text-sm font-semibold mt-1">{viewProduct.description}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {(viewProduct.itemUrl || viewProduct.itemId) && (
                    <a
                      href={viewProduct.itemUrl || `https://www.ebay.com/itm/${viewProduct.itemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-semibold bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-100 border border-orange-200 dark:border-orange-800 px-2.5 py-1 rounded-md transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver publicación en eBay
                    </a>
                  )}
                  {viewProduct.orderNumber && (
                    <a
                      href={viewProduct.orderUrl || `https://order.ebay.com/ord/show?orderId=${viewProduct.orderNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium bg-muted/60 hover:bg-muted border border-border/60 px-2.5 py-1 rounded-md transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Recibo de orden
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm p-3.5 rounded-lg border bg-muted/30">
                <div>
                  <span className="text-xs text-muted-foreground block">N° de Orden eBay:</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono font-medium text-xs">{viewProduct.orderNumber || '-'}</span>
                    {viewProduct.orderNumber && (
                      <button
                        onClick={() => handleCopy(viewProduct.orderNumber, 'view-ord', 'Orden')}
                        className="p-1 hover:bg-muted rounded"
                      >
                        {copiedId === 'view-ord' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">Fecha de Compra:</span>
                  <span className="font-medium text-xs mt-0.5 block">
                    {formatPurchaseDate(viewProduct.purchaseDate || viewProduct.createdAt)}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">Courier USA:</span>
                  <span className="font-medium text-xs mt-0.5 block">{viewProduct.courier || 'USPS'}</span>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">N° de Tracking USA:</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="font-mono font-medium text-xs truncate max-w-[120px]">{viewProduct.trackingNumber || '-'}</span>
                    {viewProduct.trackingNumber && (
                      <button
                        onClick={() => handleCopy(viewProduct.trackingNumber, 'view-tr', 'Tracking')}
                        className="p-1 hover:bg-muted rounded"
                      >
                        {copiedId === 'view-tr' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">Titular Asignado:</span>
                  <span className="font-medium text-xs mt-0.5 block">
                    {getImporterInfo(viewProduct).name}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground block">RUC SUNAT:</span>
                  <span className="font-mono font-medium text-xs mt-0.5 block">
                    {getImporterInfo(viewProduct).ruc}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm rounded-lg border p-3.5 bg-muted/20">
                <div>
                  <span className="text-xs text-muted-foreground block">Order Total USD (Compra + Envío):</span>
                  <span className="text-base font-bold text-foreground block mt-0.5">
                    ${(viewProduct.orderTotalUSD ?? (viewProduct.purchasePriceUSD + (viewProduct.shippingCostUSD || 0))).toFixed(2)}
                  </span>
                  {viewProduct.shippingCostUSD > 0 && (
                    <span className="text-[11px] text-muted-foreground block mt-0.5">
                      (Ítem: ${viewProduct.purchasePriceUSD.toFixed(2)} + Envío: ${viewProduct.shippingCostUSD.toFixed(2)})
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Total en Soles (T.C. 3.40):</span>
                  <span className="text-base font-bold text-emerald-600 block mt-0.5">
                    {formatPEN((viewProduct.orderTotalUSD ?? (viewProduct.purchasePriceUSD + (viewProduct.shippingCostUSD || 0))) * 3.40)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* eBay Search Dialog                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={ebayDialogOpen} onOpenChange={setEbayDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[95vh] sm:max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-orange-600" />
              Buscar en eBay
            </DialogTitle>
            <DialogDescription>
              Busca productos en eBay para importar a tu inventario
            </DialogDescription>
          </DialogHeader>

          {/* Search Controls */}
          <div className="space-y-4 border-b pb-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar iPhone, iPad, MacBook..."
                  value={ebayQuery}
                  onChange={(e) => setEbayQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEbaySearch()}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={handleEbaySearch}
                disabled={ebaySearching}
                className="gap-2 bg-orange-600 hover:bg-orange-700 text-white shrink-0 min-h-[44px]"
              >
                {ebaySearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="space-y-1 flex-1 sm:w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                <Select value={ebayCategory} onValueChange={setEbayCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {EBAY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex-1 sm:w-[180px]">
                <label className="text-xs font-medium text-muted-foreground">Ordenar por</label>
                <Select value={ebaySort} onValueChange={setEbaySort}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EBAY_SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Results */}
          <ScrollArea className="flex-1 min-h-0">
            {ebaySearching ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-sm text-muted-foreground">Buscando en eBay...</p>
              </div>
            ) : ebayResults.length === 0 && !ebaySearching ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Busca productos en eBay</p>
                <p className="text-sm">Ingresa un término y haz clic en &quot;Buscar&quot;</p>
              </div>
            ) : (
              <div className="space-y-3 pr-3">
                <p className="text-sm text-muted-foreground">
                  {ebayResults.length} resultado{ebayResults.length !== 1 ? 's' : ''} encontrado{ebayResults.length !== 1 ? 's' : ''}
                </p>
                {ebayResults.map((item) => (
                  <Card key={item.itemId} className="overflow-hidden">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        {/* Image */}
                        <div className="w-24 h-24 bg-muted rounded-md flex-shrink-0 overflow-hidden">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium line-clamp-2 mb-1.5">
                            {item.title}
                          </h4>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <DollarSign className="h-3 w-3" />
                              {parseFloat(item.price.value).toLocaleString('en-US', {
                                style: 'currency',
                                currency: item.price.currency,
                                minimumFractionDigits: 2,
                              })}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {item.condition}
                            </Badge>
                            {parseFloat(item.shippingCost) > 0 && (
                              <Badge variant="outline" className="text-xs">
                                +{parseFloat(item.shippingCost).toLocaleString('en-US', {
                                  style: 'currency',
                                  currency: item.price.currency,
                                })} envío
                              </Badge>
                            )}
                            {parseFloat(item.shippingCost) === 0 && (
                              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                                Envío gratis
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>{item.seller.username}</span>
                            <span>•</span>
                            <span>{item.seller.feedbackPercentage} positivo</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex sm:flex-col gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleEbayImport(item)}
                            disabled={ebayImporting === item.itemId}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs text-white flex-1 sm:flex-initial min-h-[44px]"
                          >
                            {ebayImporting === item.itemId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ShoppingBag className="h-3 w-3" />
                            )}
                            Importar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs flex-1 sm:flex-initial min-h-[44px]"
                            asChild
                          >
                            <a href={item.itemWebUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                              Ver en eBay
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ─── Embarque & Traducción Dialog ─── */}
      <EmbarqueDialog
        open={embarqueDialogOpen}
        onOpenChange={setEmbarqueDialogOpen}
        selectedProducts={selectedProductsList}
        onProductsUpdated={loadProducts}
        onClearSelection={() => setSelectedIds([])}
      />

      {/* ─── Sincronizar Ocultos de eBay Dialog ─── */}
      <SyncHiddenDialog
        open={syncHiddenOpen}
        onOpenChange={setSyncHiddenOpen}
        onSyncCompleted={loadProducts}
      />

      {/* ─── Validación con Shiper Courier Dialog ─── */}
      <ShipperVerifyDialog
        open={shipperVerifyOpen}
        onOpenChange={setShipperVerifyOpen}
        products={products}
        onVerified={loadProducts}
      />

      {/* ─── STICKY FLOATING SELECTION BAR ─── */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card/95 backdrop-blur-md border-2 border-emerald-500 shadow-2xl rounded-2xl px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 sm:gap-6 max-w-[95vw] w-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  {selectedIds.length} {selectedIds.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                </span>
                <Badge variant="outline" className="font-mono text-xs font-bold bg-emerald-50 text-emerald-800 border-emerald-300">
                  Total FOB: ${selectedFobTotal.toFixed(2)} USD
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedFobTotal <= 200 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Régimen Simplificado Courier (&lt; $200 USD)
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 inline" /> Supera $200 USD (declaración sujeta a aranceles)
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar
            </Button>
            <Button
              size="sm"
              onClick={() => setEmbarqueDialogOpen(true)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md min-h-[36px]"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Generar Documentos Shipper & Aduanas
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Utility: Guess product category from eBay category ID ──
function guessCategory(ebayCategoryId: string): ProductFormData['category'] {
  const map: Record<string, ProductFormData['category']> = {
    '6000': 'iPad',
    '111422': 'Laptop',
    '9355': 'iPhone',
    '178893': 'Smartwatch',
    '112532': 'Accesorio',
  };
  return map[ebayCategoryId] || 'Otro';
}
