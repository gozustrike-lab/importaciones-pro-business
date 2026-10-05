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
  LayoutGrid,
  ListFilter,
  MessageCircle,
  Zap,
  CheckCircle2,
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
  const [displayMode, setDisplayMode] = useState<'compact' | 'cards'>('compact');
  const [autoDetecting, setAutoDetecting] = useState(false);
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
  const [ebayRequiresAuth, setEbayRequiresAuth] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const [activeData, archivedData, nrus, ebayAcc] = await Promise.all([
        fetchProducts({ archived: 'false' }).catch((err) => {
          console.error('fetch active products error:', err);
          return [];
        }),
        fetchProducts({ archived: 'true' }).catch((err) => {
          console.error('fetch archived products error:', err);
          return [];
        }),
        fetchNRUSStatus().catch(() => null),
        fetch('/api/ebay/account')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ]);
      setProducts(activeData);
      setArchivedProducts(archivedData);
      if (nrus) setNrusStatus(nrus);
      if (ebayAcc && (ebayAcc.requiresAuth || !ebayAcc.connected)) {
        setEbayRequiresAuth(true);
      } else if (ebayAcc?.connected) {
        setEbayRequiresAuth(false);
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los productos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const [refreshingStatus, setRefreshingStatus] = useState(false);

  const handleConnectEbay = async () => {
    try {
      const res = await fetch('/api/ebay/auth');
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: 'Error de configuración',
          description: data?.error || 'No se pudo obtener la URL de autorización de eBay',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo iniciar la conexión con eBay',
        variant: 'destructive',
      });
    }
  };

  const handleRefreshStatus = useCallback(async (silent = false) => {
    try {
      setRefreshingStatus(true);
      // Sincronización en tiempo real directo con la API de eBay + Excel Google Drive
      const syncRes = await fetch('/api/ebay/sync-live', { method: 'POST' }).catch(() => null);
      const syncData = syncRes && syncRes.ok ? await syncRes.json().catch(() => null) : null;

      await loadProducts();

      if (syncData?.success) {
        setEbayRequiresAuth(false);
        const parts: string[] = [];
        if (syncData.newlyImportedCount > 0) {
          parts.push(`🛍️ ${syncData.newlyImportedCount} nueva(s) compra(s) importada(s) y guardada(s) en Excel`);
        }
        if (syncData.newlyDeliveredCount > 0) {
          parts.push(`🎉 ${syncData.newlyDeliveredCount} nuevo(s) paquete(s) en Miami`);
        }
        if (parts.length > 0) {
          toast({
            title: '✅ Sincronizado en Vivo con eBay',
            description: `${parts.join(' | ')}. Total en Miami: ${syncData.inMiamiTotal}`,
          });
        } else if (!silent) {
          toast({
            title: '✅ Sincronizado en Vivo con eBay',
            description: syncData.message || `Todo al día (${syncData.inMiamiTotal} en Miami, ${syncData.inTransitTotal} en tránsito).`,
          });
        }
      } else if (syncData?.requiresAuth) {
        setEbayRequiresAuth(true);
        if (!silent) {
          toast({
            title: '⚠️ Sesión de eBay Expirada',
            description: 'Haz clic en "Reconectar Cuenta de eBay" arriba para descargar las compras de hoy en tiempo real.',
            variant: 'destructive',
          });
        }
      } else if (!silent) {
        toast({
          title: '🔄 Inventario Actualizado',
          description: 'Se recargaron los productos y estados del sistema.',
        });
      }
    } catch {
      await loadProducts();
      if (!silent) {
        toast({
          title: 'Inventario Actualizado',
          description: 'Se recargó la información local.',
        });
      }
    } finally {
      setRefreshingStatus(false);
    }
  }, [loadProducts, toast]);

  // Auto-sync on page load and every 5 minutes in background
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('ebay=connected')) {
      window.history.replaceState({}, '', '/dashboard?tab=productos');
      toast({
        title: '🎉 ¡Cuenta de eBay Vinculada!',
        description: 'Sincronizando compras en tiempo real con tu base de datos y Excel de Google Drive...',
      });
      handleRefreshStatus(false);
    } else {
      loadProducts();
      // Sincronización silenciosa automática en segundo plano al abrir
      handleRefreshStatus(true);
    }
    const interval = setInterval(() => {
      handleRefreshStatus(true);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadProducts, handleRefreshStatus, toast]);

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
      fabio: products.filter((p) => {
        const isPeggy =
          (p.importerProfile || '').toLowerCase() === 'peggy' ||
          (p.recipientName || '').toLowerCase().includes('peggy') ||
          (p.recipientName || '').toLowerCase().includes('orduña');
        return !isPeggy;
      }).length,
      peggy: products.filter((p) => {
        const isPeggy =
          (p.importerProfile || '').toLowerCase() === 'peggy' ||
          (p.recipientName || '').toLowerCase().includes('peggy') ||
          (p.recipientName || '').toLowerCase().includes('orduña');
        return isPeggy;
      }).length,
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

  // Sort active products by purchaseDate DESC (eBay style: most recent purchases first)
  const filteredProducts = useMemo(() => {
    const list = filterProductList(products);
    return [...list].sort((a, b) => {
      const timeA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [filterProductList, products]);

  // Sort archived products by archivedAt DESC (eBay style: most recently archived/shipped first)
  const filteredArchivedProducts = useMemo(() => {
    const list = filterProductList(archivedProducts);
    return [...list].sort((a, b) => {
      const archA = a.archivedAt ? new Date(a.archivedAt).getTime() : (a.purchaseDate ? new Date(a.purchaseDate).getTime() : new Date(a.createdAt).getTime());
      const archB = b.archivedAt ? new Date(b.archivedAt).getTime() : (b.purchaseDate ? new Date(b.purchaseDate).getTime() : new Date(b.createdAt).getTime());
      if (archB !== archA) return archB - archA;
      const timeA = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
      const timeB = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
      return timeB - timeA;
    });
  }, [filterProductList, archivedProducts]);

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

  // ── Métricas Operativas Diarias (Semáforo Unificado) ──
  const unconfirmedInMiami = useMemo(() => {
    return products.filter((p) => p.status === 'USA' && !p.shipperConfirmed);
  }, [products]);

  const readyToShip = useMemo(() => {
    return products.filter((p) => p.status === 'USA' && p.shipperConfirmed);
  }, [products]);

  const readyToShipFob = useMemo(() => {
    return readyToShip.reduce((acc, p) => {
      return acc + (p.orderTotalUSD ?? (p.purchasePriceUSD + (p.shippingCostUSD || 0)));
    }, 0);
  }, [readyToShip]);

  const inTransitToMiami = useMemo(() => {
    return products.filter((p) => p.status === 'TRANSITO_USA');
  }, [products]);

  const handleAutoDetectModels = async () => {
    try {
      setAutoDetecting(true);
      const res = await fetch('/api/products/auto-detect-models', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast({
          title: '⚡ Modelos SUNAT Auto-Detectados',
          description: `Se escanearon ${data.scanned} compras y se asignaron ${data.updatedCount} modelos técnicos oficiales.`,
        });
        await loadProducts();
      } else {
        toast({ title: 'Aviso', description: data.error || 'No se pudieron actualizar los modelos' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAutoDetecting(false);
    }
  };

  const handleCopyWhatsAppShiper = () => {
    if (unconfirmedInMiami.length === 0) return;
    const lines = [
      `Hola Shiper Miami, buenos días.`,
      `Por favor confirmar recepción de los siguientes ${unconfirmedInMiami.length} paquete(s) que figuran entregados en su almacén:`,
      '',
      ...unconfirmedInMiami.map((p, idx) => {
        const imp = getImporterInfo(p);
        return `${idx + 1}) ${p.courier || 'Courier'} Tracking: ${p.trackingNumber || 'Sin tracking'}\n   Destinatario: ${imp.key === 'peggy' ? 'SHIPER PEGGY LILIANA BONILLA ORDUNA' : 'SHIPER FABIO CESAR HERRERA BONILLA'}\n   Artículo: ${p.description.slice(0, 50)}...\n   Orden: ${p.orderNumber || '-'}`;
      }),
      '',
      `Muchas gracias por su apoyo.`
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast({
      title: '📲 Mensaje para Shiper Copiado',
      description: `Texto listo para pegar en WhatsApp a Shiper con los ${unconfirmedInMiami.length} trackings y nombres de casillero.`,
    });
  };

  const handleSelectAllReadyToShip = () => {
    const ids = readyToShip.map((p) => p.id);
    setSelectedIds(ids);
    setEmbarqueDialogOpen(true);
    toast({
      title: '📋 Paquetes Seleccionados para Embarque',
      description: `${ids.length} paquetes listos en Miami listados para armar Hoja de Embarque y Hoja de Traducción SUNAT.`,
    });
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

          {/* View Mode Toggle: Compacta / Tarjetas */}
          <div className="flex rounded-lg border border-border overflow-hidden bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setDisplayMode('compact')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                displayMode === 'compact'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Vista de tabla compacta de alta densidad (recomendada)"
            >
              <ListFilter className="h-3.5 w-3.5 text-emerald-600" />
              <span>Compacta</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('cards')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                displayMode === 'cards'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Vista extendida en tarjetas"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-slate-600" />
              <span>Tarjetas</span>
            </button>
          </div>

          <Button
            onClick={handleAutoDetectModels}
            disabled={autoDetecting || loading}
            variant="outline"
            className="gap-1.5 border-blue-300 text-blue-800 bg-blue-50/70 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300 min-h-[40px] font-semibold text-xs shadow-xs"
            title="Detecta automáticamente modelos técnicos oficiales SUNAT (A1701, A2141, Latitude, etc.) desde la descripción"
          >
            <Zap className={`h-4 w-4 text-blue-600 ${autoDetecting ? 'animate-spin' : ''}`} />
            <span>{autoDetecting ? 'Detectando...' : 'Auto-Detectar Modelos'}</span>
          </Button>

          <Button
            onClick={() => handleRefreshStatus(false)}
            disabled={refreshingStatus || loading}
            variant="outline"
            className="gap-2 border-emerald-400 text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 min-h-[40px] font-bold shadow-xs text-xs"
            title="Sincroniza en 1 clic tus compras nuevas de eBay, estados en Miami y Excel de Google Drive (también corre automático cada 5 min)"
          >
            <RefreshCw className={`h-4 w-4 text-emerald-600 ${refreshingStatus ? 'animate-spin' : ''}`} />
            <span>{refreshingStatus ? 'Sincronizando eBay...' : 'Sincronizar eBay'}</span>
          </Button>

          <Button
            onClick={() => setEmbarqueDialogOpen(true)}
            variant="outline"
            className="gap-2 border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 min-h-[40px] font-semibold text-xs"
            title="Generar Hoja de Embarque y Hoja de Traducción SUNAT"
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
            onClick={() => {
              setEditProduct(null);
              setDialogOpen(true);
            }}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[40px] font-semibold text-xs"
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* EBAY OAUTH RECONNECT BANNER (REAL-TIME SYNC)                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {ebayRequiresAuth && (
        <Card className="border-amber-400 dark:border-amber-800 bg-amber-50/95 dark:bg-amber-950/40 shadow-sm overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                    ⚠️ Sesión de eBay Expirada — Reconexión Requerida para Compras de Hoy
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                    Para descargar automáticamente tus compras de hoy, detectar llegadas a Miami y autoguardar en tu Excel de Google Drive (Fabio / Liliana), autoriza tu cuenta de eBay con 1 clic.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleConnectEbay}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-2 min-h-[38px] shadow-xs"
                >
                  <ExternalLink className="h-4 w-4" />
                  Reconectar Cuenta de eBay
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SEMÁFORO OPERATIVO DIARIO (CENTRO DE CONTROL UNIFICADO)        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: ALERTA CRÍTICA - PAQUETES SIN CONFIRMAR EN MIAMI */}
        <Card className={`border shadow-sm transition-all ${
          unconfirmedInMiami.length > 0
            ? 'border-amber-400 bg-amber-50/75 dark:bg-amber-950/30'
            : 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20'
        }`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${
                  unconfirmedInMiami.length > 0
                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                }`}>
                  {unconfirmedInMiami.length > 0 ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Almacén Miami • Shiper
                  </h4>
                  <p className="text-sm font-bold text-foreground">
                    {unconfirmedInMiami.length > 0
                      ? `🚨 ${unconfirmedInMiami.length} sin confirmar por Shiper`
                      : '✅ 100% Verificado al Día'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={`text-[10px] font-bold ${
                unconfirmedInMiami.length > 0
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
              }`}>
                {unconfirmedInMiami.length} alerta{unconfirmedInMiami.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {unconfirmedInMiami.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Entregados según courier, pero Shiper aún no los escanea en su sistema:
                </p>
                <div className="space-y-1.5 max-h-[115px] overflow-y-auto pr-1">
                  {unconfirmedInMiami.map((p) => {
                    const imp = getImporterInfo(p);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-background/90 border text-[11px] shadow-2xs">
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground truncate block">
                            {p.courier || 'Courier'} • {p.trackingNumber || p.orderNumber}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate block">
                            {imp.name} — {p.description.slice(0, 32)}...
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] gap-1 border-emerald-400 text-emerald-700 hover:bg-emerald-50 shrink-0 font-bold"
                          onClick={() => handleToggleShipperConfirmed(p)}
                          title="Confirmar recepción en Miami con 1 clic"
                        >
                          <Check className="h-3 w-3" /> OK
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  onClick={handleCopyWhatsAppShiper}
                  className="w-full h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-2xs"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Copiar WhatsApp para Shiper
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                Todos los paquetes entregados en Miami están confirmados físicamente por Shiper. No hay ningún paquete extraviado ni pendiente de escaneo.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: LISTOS PARA PRÓXIMO EMBARQUE */}
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Próximo Embarque
                  </h4>
                  <p className="text-sm font-bold text-foreground">
                    📦 {readyToShip.length} paquetes listos en Miami
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border-emerald-300">
                ${readyToShipFob.toFixed(2)} USD
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Total FOB acumulado:</span>
                <span className="font-bold text-foreground">${readyToShipFob.toFixed(2)} USD ({formatPEN(readyToShipFob * 3.4)})</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>En camino a Miami:</span>
                <span className="font-semibold text-sky-600">{inTransitToMiami.length} paquete{inTransitToMiami.length !== 1 ? 's' : ''} en tránsito</span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleSelectAllReadyToShip}
              disabled={readyToShip.length === 0}
              className="w-full h-8 text-xs bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white font-semibold gap-1.5 shadow-2xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-600" />
              Armar Hoja de Embarque SUNAT ({readyToShip.length})
            </Button>
          </CardContent>
        </Card>

        {/* Card 3: TERMÓMETRO NRUS SUNAT MENSUAL */}
        <Card className="border border-border/80 bg-card shadow-sm">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Cupo SUNAT / NRUS Mensual
                  </h4>
                  <p className="text-sm font-bold text-foreground truncate max-w-[190px]">
                    {nrusStatus?.recommendation ? `💡 Sugerido: ${nrusStatus.recommendation.target === 'peggy' ? 'Peggy' : 'Fabio'}` : 'Monitoreo de Cupo'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-semibold bg-muted">
                Cat 1: S/ 5,000
              </Badge>
            </div>

            {/* Progress Bars for Fabio & Peggy */}
            <div className="space-y-2 pt-1 text-xs">
              {/* Fabio */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-blue-700 dark:text-blue-400">👤 Fabio César</span>
                  <span className="font-mono text-muted-foreground">
                    {formatPEN(nrusStatus?.byImporter?.fabio?.monthlyPurchasesPen || 0)} / S/ 5,000
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      (nrusStatus?.byImporter?.fabio?.percentageOfLimit || 0) > 85 ? 'bg-red-500' : (nrusStatus?.byImporter?.fabio?.percentageOfLimit || 0) > 65 ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, nrusStatus?.byImporter?.fabio?.percentageOfLimit || 0))}%` }}
                  />
                </div>
              </div>

              {/* Peggy */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-purple-700 dark:text-purple-400">👩 Peggy Liliana</span>
                  <span className="font-mono text-muted-foreground">
                    {formatPEN(nrusStatus?.byImporter?.peggy?.monthlyPurchasesPen || 0)} / S/ 5,000
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      (nrusStatus?.byImporter?.peggy?.percentageOfLimit || 0) > 85 ? 'bg-red-500' : (nrusStatus?.byImporter?.peggy?.percentageOfLimit || 0) > 65 ? 'bg-amber-500' : 'bg-purple-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, nrusStatus?.byImporter?.peggy?.percentageOfLimit || 0))}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick RUC Copy Button */}
            {nrusStatus?.recommendation?.targetRuc ? (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(nrusStatus.recommendation!.targetRuc);
                  toast({
                    title: 'RUC Copiado',
                    description: `RUC ${nrusStatus.recommendation!.targetRuc} (${nrusStatus.recommendation!.targetName}) copiado al portapapeles.`,
                  });
                }}
                className="w-full text-center text-[11px] text-primary hover:underline font-semibold flex items-center justify-center gap-1 pt-1 cursor-pointer"
              >
                <Copy className="h-3 w-3" />
                Copiar RUC {nrusStatus.recommendation.targetName}: {nrusStatus.recommendation.targetRuc}
              </button>
            ) : (
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                Límites controlados para régimen tributario especial.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Owner Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setImporterFilter('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
            importerFilter === 'all'
              ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs font-bold'
              : 'bg-card text-muted-foreground hover:bg-accent border-border'
          }`}
        >
          👥 Ambos ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => setImporterFilter('fabio')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
            importerFilter === 'fabio'
              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
              : 'bg-blue-50/60 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 hover:bg-blue-100'
          }`}
        >
          👤 Solo Fabio ({counts.fabio})
        </button>
        <button
          type="button"
          onClick={() => setImporterFilter('peggy')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
            importerFilter === 'peggy'
              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-bold'
              : 'bg-purple-50/60 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 hover:bg-purple-100'
          }`}
        >
          👩 Solo Peggy ({counts.peggy})
        </button>
      </div>

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
                      {p.isArchived && p.archivedAt && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                          <Archive className="h-2.5 w-2.5" />
                          Embarcado: {formatPurchaseDate(p.archivedAt)}
                        </span>
                      )}
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
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                📦 Productos Archivados — Ya Embarcados a Perú
              </p>
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-1.5 py-0 shadow-2xs">
                Ordenado por más reciente (como en eBay)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ordenados cronológicamente por la fecha de archivado y embarque más reciente hacia Lima. Puedes restaurarlos si es necesario.
            </p>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0 bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-300 font-mono">
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
            displayMode === 'compact' ? (
              <div className="overflow-x-auto w-full">
                <Table className="w-full text-xs">
                  <TableHeader className="bg-muted/50 border-b">
                    <TableRow className="h-10 hover:bg-transparent">
                      <TableHead className="w-[38px] px-2 text-center">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center cursor-pointer"
                          title={allCurrentSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                        >
                          {allCurrentSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground/60" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="min-w-[280px] max-w-[420px] font-semibold text-foreground">
                        Compra / Artículo eBay
                      </TableHead>
                      <TableHead className="w-[140px] font-semibold text-foreground">
                        Orden & Fecha
                      </TableHead>
                      <TableHead className="w-[160px] font-semibold text-foreground">
                        Courier & Tracking
                      </TableHead>
                      <TableHead className="w-[120px] font-semibold text-foreground">
                        Titular SUNAT
                      </TableHead>
                      <TableHead className="w-[135px] font-semibold text-foreground">
                        Estado Miami
                      </TableHead>
                      <TableHead className="w-[110px] text-right font-semibold text-foreground">
                        Total Compra
                      </TableHead>
                      <TableHead className="w-[120px] text-right font-semibold text-foreground">
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentList.map((p, idx) => {
                      const imp = getImporterInfo(p);
                      const st = statusConfig[p.status] || statusConfig.USA;
                      const trackUrl = getTrackingUrl(p.courier, p.trackingNumber);
                      const ebayItemUrl =
                        p.itemUrl || (p.itemId ? `https://www.ebay.com/itm/${p.itemId}` : null);
                      const ebayOrderUrl =
                        p.orderUrl || (p.orderNumber ? `https://order.ebay.com/ord/show?orderId=${p.orderNumber}` : null);
                      const ebayPrimaryUrl = ebayItemUrl || ebayOrderUrl;
                      const orderTotal = p.orderTotalUSD ?? (p.purchasePriceUSD + (p.shippingCostUSD || 0));
                      const orderTotalPEN = orderTotal * 3.40;

                      return (
                        <TableRow
                          key={p.id}
                          className={`hover:bg-muted/40 transition-colors h-14 border-b border-border/50 ${
                            selectedIds.includes(p.id) ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : ''
                          } ${p.isArchived ? 'opacity-80 bg-slate-50/50 dark:bg-slate-950/20' : ''}`}
                        >
                          {/* 1. Checkbox */}
                          <TableCell className="w-[38px] px-2 text-center py-2">
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(p.id)}
                              className="p-1 rounded hover:bg-muted transition-colors inline-flex items-center justify-center cursor-pointer"
                              title={selectedIds.includes(p.id) ? "Deseleccionar" : "Seleccionar para embarque"}
                            >
                              {selectedIds.includes(p.id) ? (
                                <CheckSquare className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground/50 hover:text-foreground" />
                              )}
                            </button>
                          </TableCell>

                          {/* 2. Photo & Product Title & Model & Qty */}
                          <TableCell className="py-2 pr-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="shrink-0 font-mono text-[11px] font-semibold text-muted-foreground w-6 text-center">
                                #{String(idx + 1).padStart(2, '0')}
                              </span>
                              {p.imageUrl ? (
                                <a
                                  href={ebayPrimaryUrl || p.imageUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 h-9 w-9 rounded-md border bg-white dark:bg-zinc-900 overflow-hidden flex items-center justify-center p-0.5 hover:ring-2 hover:ring-emerald-500 transition-all shadow-2xs"
                                  title="Ver producto original en eBay"
                                >
                                  <img
                                    src={p.imageUrl}
                                    alt={p.description}
                                    loading="lazy"
                                    className="max-h-8 max-w-8 object-contain"
                                  />
                                </a>
                              ) : (
                                <div className="shrink-0 h-9 w-9 rounded-md border bg-muted flex items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground/60" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={ebayPrimaryUrl || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-xs sm:text-sm text-foreground hover:text-emerald-600 truncate max-w-[320px] xl:max-w-[460px] inline-block transition-colors"
                                    title={p.description}
                                  >
                                    {p.description}
                                  </a>
                                  {ebayPrimaryUrl && (
                                    <ExternalLink className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {/* Model chip */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSingleEmbarque(p)}
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                                      p.model && p.model !== 'Sin modelo'
                                        ? 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 hover:bg-blue-100'
                                        : 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 hover:bg-amber-200'
                                    }`}
                                    title="Modelo técnico oficial para SUNAT. Clic para editar."
                                  >
                                    <span>Mod: {p.model && p.model !== 'Sin modelo' ? p.model : '⚠️ Sin modelo'}</span>
                                    <Pencil className="h-2 w-2 opacity-50" />
                                  </button>

                                  {/* Qty tag (ONLY IF > 1) */}
                                  {p.quantity > 1 && (
                                    <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0">
                                      x{p.quantity} unids
                                    </Badge>
                                  )}

                                  {p.isArchived && (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1 text-slate-600 border-slate-300 dark:text-slate-400">
                                      Archivado
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          {/* 3. Orden & Fecha */}
                          <TableCell className="py-2 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 font-mono text-[11px]">
                                <span className="font-semibold text-foreground truncate max-w-[110px]">{p.orderNumber || '-'}</span>
                                {p.orderNumber && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(p.orderNumber, `ord-${p.id}`, 'Orden')}
                                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                                    title="Copiar orden"
                                  >
                                    {copiedId === `ord-${p.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                  </button>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {formatPurchaseDate(p.purchaseDate || p.createdAt)}
                              </p>
                            </div>
                          </TableCell>

                          {/* 4. Courier & Tracking */}
                          <TableCell className="py-2 text-xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className={`text-[10px] font-bold px-1.5 py-0 ${getCourierBadge(p.courier)}`}>
                                  {p.courier || 'USPS'}
                                </Badge>
                              </div>
                              {p.trackingNumber ? (
                                <div className="flex items-center gap-1 font-mono text-[11px] pt-0.5">
                                  {trackUrl ? (
                                    <a
                                      href={trackUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline truncate max-w-[115px] font-medium"
                                      title="Rastrear en sitio oficial"
                                    >
                                      {p.trackingNumber}
                                    </a>
                                  ) : (
                                    <span className="truncate max-w-[115px] font-medium">{p.trackingNumber}</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(p.trackingNumber, `tr-${p.id}`, 'Tracking')}
                                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                                    title="Copiar tracking"
                                  >
                                    {copiedId === `tr-${p.id}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic">Sin tracking</span>
                              )}
                            </div>
                          </TableCell>

                          {/* 5. Titular SUNAT */}
                          <TableCell className="py-2 text-xs">
                            <div className="space-y-0.5">
                              <Badge variant="outline" className={`text-[11px] font-semibold ${imp.badge}`}>
                                {imp.key === 'peggy' ? '👩 Peggy' : '👤 Fabio'}
                              </Badge>
                              <p className="text-[10px] font-mono text-muted-foreground">
                                {imp.ruc}
                              </p>
                            </div>
                          </TableCell>

                          {/* 6. Estado Shiper / Miami */}
                          <TableCell className="py-2 text-xs">
                            <div>
                              {p.status === 'USA' ? (
                                p.shipperConfirmed ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleShipperConfirmed(p)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 hover:bg-amber-100 text-emerald-800 hover:text-amber-900 border border-emerald-300 transition-colors shadow-2xs group cursor-pointer"
                                    title="Confirmado por Shiper Miami. Clic para cambiar a Pendiente."
                                  >
                                    <Check className="h-3 w-3 text-emerald-600 group-hover:hidden" />
                                    <span className="group-hover:hidden">✓ Shiper OK</span>
                                    <span className="hidden group-hover:inline">⚠️ Cambiar</span>
                                  </button>
                                ) : (
                                  <div className="inline-flex items-center gap-1">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                      ⚠️ Pendiente
                                    </span>
                                    <Button
                                      size="sm"
                                      onClick={() => handleToggleShipperConfirmed(p)}
                                      className="h-5 px-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold cursor-pointer"
                                      title="Marcar como Shiper OK"
                                    >
                                      OK
                                    </Button>
                                  </div>
                                )
                              ) : p.status === 'TRANSITO_USA' ? (
                                <div className="inline-flex items-center gap-1">
                                  <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800 border-sky-300">
                                    🚚 En Tránsito
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleQuickMarkMiami(p)}
                                    className="h-5 px-1 text-[9px] font-bold bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 cursor-pointer"
                                    title="Llegó a Miami hoy"
                                  >
                                    Llegó
                                  </Button>
                                </div>
                              ) : (
                                <Badge variant="outline" className={`text-[10px] ${st.badge}`}>
                                  {st.label}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* 7. Total Compra */}
                          <TableCell className="py-2 text-right">
                            <div>
                              <p className="font-bold text-xs sm:text-sm text-foreground">
                                ${orderTotal.toFixed(2)}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatPEN(orderTotalPEN)}
                              </p>
                            </div>
                          </TableCell>

                          {/* 8. Acciones */}
                          <TableCell className="py-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                onClick={() => handleOpenSingleEmbarque(p)}
                                title="Embarque & Traducción SUNAT"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => setViewProduct(p)}
                                title="Ver Detalle"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditProduct(p);
                                  setDialogOpen(true);
                                }}
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {p.isArchived ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => handleArchive(p.id, false)}
                                  title="Restaurar al inventario activo"
                                >
                                  <ArchiveRestore className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                  onClick={() => handleArchive(p.id, true)}
                                  title="Archivar"
                                >
                                  <Archive className="h-3.5 w-3.5" />
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
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
                {currentList.map((p, idx) => {
                  const imp = getImporterInfo(p);
                  const st = statusConfig[p.status] || statusConfig.USA;
                  const trackUrl = getTrackingUrl(p.courier, p.trackingNumber);
                  const ebayItemUrl =
                    p.itemUrl || (p.itemId ? `https://www.ebay.com/itm/${p.itemId}` : null);
                  const ebayOrderUrl =
                    p.orderUrl || (p.orderNumber ? `https://order.ebay.com/ord/show?orderId=${p.orderNumber}` : null);
                  const ebayPrimaryUrl = ebayItemUrl || ebayOrderUrl;
                  const orderTotal = p.orderTotalUSD ?? (p.purchasePriceUSD + (p.shippingCostUSD || 0));
                  const orderTotalPEN = orderTotal * 3.40;

                  return (
                    <Card key={p.id} className={`border shadow-xs hover:border-emerald-300 transition-all ${selectedIds.includes(p.id) ? 'border-emerald-500 bg-emerald-50/20' : ''}`}>
                      <CardContent className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(p.id)}
                              className="p-1 rounded hover:bg-muted transition-colors mt-0.5 cursor-pointer"
                            >
                              {selectedIds.includes(p.id) ? (
                                <CheckSquare className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground/60" />
                              )}
                            </button>
                            {p.imageUrl && (
                              <img src={p.imageUrl} alt={p.description} className="h-10 w-10 object-contain rounded border bg-white p-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-foreground line-clamp-1" title={p.description}>
                                #{String(idx + 1).padStart(2, '0')} {p.description}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <Badge variant="outline" className={`text-[10px] ${imp.badge}`}>{imp.name}</Badge>
                                <Badge variant="outline" className={`text-[10px] ${st.badge}`}>{st.label}</Badge>
                                {p.model && <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700">Mod: {p.model}</Badge>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-sm text-foreground">${orderTotal.toFixed(2)}</span>
                            <p className="text-[10px] text-muted-foreground">{formatPEN(orderTotalPEN)}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50 text-muted-foreground">
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <span>{p.courier || 'Courier'}: {p.trackingNumber || 'Sin tracking'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleOpenSingleEmbarque(p)}>
                              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 mr-1" /> Embarque
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewProduct(p)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditProduct(p); setDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )
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
