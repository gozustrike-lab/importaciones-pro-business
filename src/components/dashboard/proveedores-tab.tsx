'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Search, Eye, Pencil, Trash2, Store, ExternalLink, Star,
  Globe, Mail, Phone, Link2, FileSpreadsheet, FileText, StickyNote,
  RefreshCw, Package, DollarSign, Upload, Loader2, X, Unplug, CheckCircle2,
  Bell, BellRing, Tag, Flame, Sparkles, TrendingDown, ShoppingBag,
  ShoppingCart, Check, Copy, Filter, Layers, Percent, Clock, Bookmark,
  ShieldCheck, AlertTriangle, ArrowRight, Zap
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
import { Textarea } from '@/components/ui/textarea';
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
import { Separator } from '@/components/ui/separator';
import {
  fetchSuppliers, fetchSupplier, createSupplier, updateSupplier,
  deleteSupplier, createSupplierLink, syncSupplier, fetchEbayAccountStatus,
  fetchEbayAuthUrl, disconnectEbayAccount, fetchEbayUser,
} from '@/lib/api';
import type {
  Supplier, SupplierDetail, SupplierFormData, SupplierLink,
  SupplierLinkFormData, SupplierCategory, SupplierLinkType, SupplierLinkStatus,
  EbayAccountStatus,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// ── Types for Deal Trackers ──
export interface DealTrackerItem {
  id: string;
  title: string;
  keywords: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string; url: string; rating: number; totalOrders: number } | null;
  sellerUsername?: string | null;
  storeUrl?: string | null;
  category: string;
  maxPriceUsd?: number | null;
  minDiscountPct?: number | null;
  condition: string;
  isActive: boolean;
  notificationsEnabled: boolean;
  lastCheckedAt?: string | null;
  lastFoundCount: number;
  deals: TrackedDealItem[];
}

export interface TrackedDealItem {
  id: string;
  trackerId: string;
  itemId: string;
  title: string;
  itemUrl: string;
  imageUrl: string;
  sellerUsername: string;
  sellerFeedback: string;
  currentPriceUsd: number;
  originalPriceUsd?: number | null;
  discountPct?: number | null;
  couponCode?: string | null;
  promoDescription?: string | null;
  condition: string;
  isRead: boolean;
  isStarred: boolean;
  foundAt: string;
}

// ── Plantillas Rápidas basadas en Compras Reales en eBay ──
const QUICK_TEMPLATES = [
  {
    id: 'ipad-pro-105',
    label: '📱 iPad Pro 10.5 A1701 / A1709',
    badge: 'Comprado $89-$100',
    title: 'iPad Pro 10.5 A1701 64GB',
    keywords: 'iPad Pro 10.5 A1701 64GB',
    sellerUsername: 'itsworthmore',
    sellerLink: 'https://www.ebay.com/str/itsworthmore',
    maxPriceUsd: '110',
    minDiscountPct: '15',
    category: 'Tablets',
    condition: 'Used',
  },
  {
    id: 'ipad-9-64',
    label: '📱 iPad 9na Gen A2603 (64GB)',
    badge: 'Comprado $90-$99',
    title: 'iPad 9th Gen A2603 64GB',
    keywords: 'iPad 9th Gen A2603 64GB',
    sellerUsername: 'wikiwoo',
    sellerLink: 'https://www.ebay.com/str/wikiwoo',
    maxPriceUsd: '99',
    minDiscountPct: '15',
    category: 'Tablets',
    condition: 'Used',
  },
  {
    id: 'macbook-pro',
    label: '💻 MacBook Pro i7 16GB / 512GB',
    badge: 'Comprado $160-$185',
    title: 'MacBook Pro i7 16GB 512GB',
    keywords: 'MacBook Pro 13 i7 16GB',
    sellerUsername: '',
    sellerLink: '',
    maxPriceUsd: '190',
    minDiscountPct: '20',
    category: 'Laptops',
    condition: 'Used',
  },
  {
    id: 'ipad-7-8',
    label: '📱 iPad 7ma / 8va Gen A2200',
    badge: 'Comprado $30-$45',
    title: 'iPad 7 A2200 32GB',
    keywords: 'iPad 7 A2200 32GB',
    sellerUsername: 'preownedtech',
    sellerLink: 'https://www.ebay.com/str/preownedtech',
    maxPriceUsd: '55',
    minDiscountPct: '15',
    category: 'Tablets',
    condition: 'Used',
  },
  {
    id: 'ipad-air-3',
    label: '📱 iPad Air 3ra / 4ta Gen',
    badge: 'Comprado $95-$119',
    title: 'iPad Air 3rd Gen 256GB',
    keywords: 'iPad Air 3rd Gen 256GB',
    sellerUsername: 'smartresale',
    sellerLink: 'https://www.ebay.com/str/smartresale',
    maxPriceUsd: '120',
    minDiscountPct: '15',
    category: 'Tablets',
    condition: 'Used',
  },
  {
    id: 'itsworthmore-outlet',
    label: '🏪 Liquidaciones ItsWorthMore',
    badge: '38 compras TOP',
    title: 'Outlet Liquidaciones ItsWorthMore',
    keywords: 'Apple iPad',
    sellerUsername: 'itsworthmore',
    sellerLink: 'https://www.ebay.com/str/itsworthmore',
    maxPriceUsd: '150',
    minDiscountPct: '20',
    category: 'Tablets',
    condition: 'Used',
  },
];

// Helper: Generates a guaranteed working live eBay search URL (NEVER 404!)
function getBuyNowUrl(deal: TrackedDealItem): string {
  if (deal.itemUrl && deal.itemUrl.includes('ebay.com/sch/')) {
    return deal.itemUrl;
  }
  const cleanQ = (deal.title || '')
    .replace(/Apple\s+/gi, '')
    .replace(/-\s*Tested\s*100%\s*OK/gi, '')
    .replace(/READ\s+DESCRIPTION/gi, '')
    .replace(/\(Very Good\)/gi, '')
    .replace(/\(Very Good Condition\)/gi, '')
    .replace(/Excellent Condition/gi, '')
    .replace(/Very Good Refurbished/gi, '')
    .replace(/[()[\]*]/g, ' ')
    .trim();
  const sellerParam = deal.sellerUsername ? `&_ssn=${encodeURIComponent(deal.sellerUsername)}` : '';
  return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(cleanQ)}${sellerParam}&LH_BIN=1&_sop=15`;
}

// ── Constants ──
const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  electronics: 'Electrónica',
  accessories: 'Accesorios',
  components: 'Componentes',
  peripherals: 'Periféricos',
  cables: 'Cables',
  packaging: 'Empaque',
  other: 'Otro',
};

const COUNTRIES = [
  { value: 'US', label: '🇺🇸 Estados Unidos' },
  { value: 'CN', label: '🇨🇳 China' },
  { value: 'JP', label: '🇯🇵 Japón' },
  { value: 'KR', label: '🇰🇷 Corea' },
  { value: 'GB', label: '🇬🇧 Reino Unido' },
  { value: 'DE', label: '🇩🇪 Alemania' },
  { value: 'PE', label: '🇵🇪 Perú' },
];

function RatingStars({ rating, onRate, size = 'sm' }: { rating: number; onRate?: (r: number) => void; size?: 'sm' | 'md' }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const val = i + 1;
        const filled = val <= (hovered || rating);
        return (
          <button
            key={i}
            type="button"
            className={`${onRate ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
            onMouseEnter={() => onRate && setHovered(val)}
            onMouseLeave={() => onRate && setHovered(0)}
            onClick={() => onRate && onRate(val)}
          >
            <Star
              className={`${size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} ${
                filled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function ProveedoresTab() {
  const { toast } = useToast();

  // Sub-Navigation Tabs
  const [activeTab, setActiveTab] = useState<'radar' | 'proveedores' | 'alertas'>('radar');

  // Supplier List State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Deal Trackers State
  const [trackers, setTrackers] = useState<DealTrackerItem[]>([]);
  const [trackersLoading, setTrackersLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [scanningAll, setScanningAll] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [importingDealId, setImportingDealId] = useState<string | null>(null);
  const [dealFilter, setDealFilter] = useState<'all' | 'discount_20' | 'coupon' | 'starred'>('all');
  const [dealSearch, setDealSearch] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Live Real-Time Search Bar State
  const [liveSeller, setLiveSeller] = useState<string>('itsworthmore');
  const [liveKeywords, setLiveKeywords] = useState<string>('iPad Pro 10.5 A1701');
  const [liveMaxPrice, setLiveMaxPrice] = useState<string>('110');

  // Tracker Modal State
  const [trackerModalOpen, setTrackerModalOpen] = useState(false);
  const [trackerForm, setTrackerForm] = useState({
    title: '',
    keywords: '',
    sellerLink: '',
    supplierId: '',
    maxPriceUsd: '',
    minDiscountPct: '15',
    condition: 'Used',
    category: 'Tablets',
    notificationsEnabled: true,
  });
  const [savingTracker, setSavingTracker] = useState(false);

  // Supplier Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Detail dialog
  const [detailSupplier, setDetailSupplier] = useState<SupplierDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Link dialog
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);

  // Supplier Form
  const [formData, setFormData] = useState<SupplierFormData>({
    name: '',
    website: '',
    url: '',
    contactEmail: '',
    contactPhone: '',
    country: 'US',
    notes: '',
    category: 'electronics',
    rating: 5,
    isActive: true,
  });

  // eBay Status
  const [ebayStatus, setEbayStatus] = useState<EbayAccountStatus | null>(null);
  const [ebayCardDismissed, setEbayCardDismissed] = useState(false);

  // 1. Load Suppliers
  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSuppliers();
      setSuppliers(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los proveedores', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // 2. Load Deal Trackers & Deals
  const loadTrackers = useCallback(async () => {
    try {
      setTrackersLoading(true);
      const res = await fetch('/api/deal-trackers');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar buscadores');

      setTrackers(data.trackers || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setTrackersLoading(false);
    }
  }, []);

  // 3. Load eBay Status
  const loadEbayStatus = useCallback(async () => {
    try {
      const data = await fetchEbayAccountStatus();
      setEbayStatus(data);
    } catch {
      setEbayStatus({ configured: false, connected: false });
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
    loadTrackers();
    loadEbayStatus();
  }, [loadSuppliers, loadTrackers, loadEbayStatus]);

  // All deals aggregated across trackers
  const allDeals = useMemo(() => {
    const list: TrackedDealItem[] = [];
    trackers.forEach((t) => {
      if (t.deals) {
        list.push(...t.deals);
      }
    });
    return list.sort((a, b) => new Date(b.foundAt).getTime() - new Date(a.foundAt).getTime());
  }, [trackers]);

  // Filtered Deals for the Feed
  const filteredDeals = useMemo(() => {
    let list = allDeals;

    if (dealFilter === 'discount_20') {
      list = list.filter((d) => (d.discountPct || 0) >= 20);
    } else if (dealFilter === 'coupon') {
      list = list.filter((d) => Boolean(d.couponCode));
    } else if (dealFilter === 'starred') {
      list = list.filter((d) => d.isStarred);
    }

    if (dealSearch.trim()) {
      const q = dealSearch.toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.sellerUsername.toLowerCase().includes(q) ||
          (d.promoDescription || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [allDeals, dealFilter, dealSearch]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({ title: 'Copiado', description: 'Código de descuento copiado al portapapeles' });
  };

  // Launch live search directly on eBay (100% active, zero 404!)
  const handleLaunchLiveEbay = (seller?: string, query?: string, maxPrice?: string) => {
    const q = (query || 'iPad').trim();
    const s = (seller || '').trim();
    const p = maxPrice ? parseFloat(maxPrice) : null;

    let url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_BIN=1&_sop=15`;
    if (s && s !== 'all') {
      url += `&_ssn=${encodeURIComponent(s)}`;
    }
    if (p && p > 0) {
      url += `&_udhi=${p}`;
    }

    window.open(url, '_blank');
  };

  // Apply Quick Template
  const handleApplyTemplate = (tmpl: (typeof QUICK_TEMPLATES)[number]) => {
    setLiveKeywords(tmpl.keywords);
    setLiveSeller(tmpl.sellerUsername || 'all');
    setLiveMaxPrice(tmpl.maxPriceUsd);

    setTrackerForm({
      title: tmpl.title,
      keywords: tmpl.keywords,
      sellerLink: tmpl.sellerLink,
      supplierId: '',
      maxPriceUsd: tmpl.maxPriceUsd,
      minDiscountPct: tmpl.minDiscountPct,
      condition: tmpl.condition,
      category: tmpl.category,
      notificationsEnabled: true,
    });

    toast({
      title: '⚡ Plantilla Cargada',
      description: `${tmpl.label} listo para buscar en vivo o guardar como rastreador.`,
    });
  };

  // 4. Scan All Trackers for Deals
  const handleScanAll = async () => {
    try {
      setScanningAll(true);
      const res = await fetch('/api/deal-trackers/scan-all', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al escanear');

      toast({
        title: '🎯 Escaneo Completado',
        description: data.message || 'Se han actualizado las promociones y descuentos.',
      });
      await loadTrackers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setScanningAll(false);
    }
  };

  // 5. Scan a Specific Tracker
  const handleScanSingleTracker = async (trackerId: string) => {
    try {
      setScanningId(trackerId);
      const res = await fetch(`/api/deal-trackers/${trackerId}/scan`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al escanear');

      toast({
        title: '🔥 ¡Oferta Encontrada!',
        description: data.message || 'Se encontró una nueva promoción para este buscador.',
      });
      await loadTrackers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setScanningId(null);
    }
  };

  // 6. Create Deal Tracker
  const handleSaveTracker = async () => {
    if (!trackerForm.title || !trackerForm.keywords) {
      toast({ title: 'Campo requerido', description: 'Indica un título y palabras clave de búsqueda', variant: 'destructive' });
      return;
    }

    try {
      setSavingTracker(true);
      const res = await fetch('/api/deal-trackers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trackerForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear buscador');

      toast({
        title: '🎯 Buscador Activado',
        description: `Rastreador "${trackerForm.title}" creado con alertas en tiempo real.`,
      });
      setTrackerModalOpen(false);
      await loadTrackers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingTracker(false);
    }
  };

  // 7. 1-Click Import Deal to Products Inventory
  const handleImportDealToProduct = async (deal: TrackedDealItem) => {
    try {
      setImportingDealId(deal.id);
      const res = await fetch(`/api/deal-trackers/deals/${deal.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar producto');

      toast({
        title: '📦 Compra Pre-Registrada',
        description: data.message || 'El producto se añadió al inventario en tránsito.',
      });
      await loadTrackers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setImportingDealId(null);
    }
  };

  // 8. Toggle Star Deal
  const handleToggleStarDeal = async (deal: TrackedDealItem) => {
    try {
      await fetch(`/api/deal-trackers/deals/${deal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: !deal.isStarred }),
      });
      await loadTrackers();
    } catch (err) {
      console.error(err);
    }
  };

  // 9. Dismiss Deal
  const handleDismissDeal = async (dealId: string) => {
    try {
      await fetch(`/api/deal-trackers/deals/${dealId}`, { method: 'DELETE' });
      toast({ title: 'Oferta descartada', description: 'Se eliminó de la lista de alertas.' });
      await loadTrackers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // 10. Pre-fill Tracker for a specific supplier
  const handleTrackSupplier = (supplier: Supplier) => {
    setLiveSeller(supplier.name.toLowerCase());
    setTrackerForm({
      title: `Ofertas de ${supplier.name}`,
      keywords: 'iPad 10.2',
      sellerLink: supplier.url || supplier.website || supplier.name,
      supplierId: supplier.id,
      maxPriceUsd: '150',
      minDiscountPct: '15',
      condition: 'Used',
      category: supplier.category || 'Tablets',
      notificationsEnabled: true,
    });
    setTrackerModalOpen(true);
  };

  // Supplier Form Handlers
  const handleOpenCreateSupplier = () => {
    setEditSupplier(null);
    setFormData({
      name: '',
      website: '',
      url: '',
      contactEmail: '',
      contactPhone: '',
      country: 'US',
      notes: '',
      category: 'electronics',
      rating: 5,
      isActive: true,
    });
    setFormOpen(true);
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setEditSupplier(supplier);
    setFormData({
      name: supplier.name,
      website: supplier.website,
      url: supplier.url,
      contactEmail: supplier.contactEmail,
      contactPhone: supplier.contactPhone,
      country: supplier.country,
      notes: supplier.notes,
      category: supplier.category,
      rating: supplier.rating,
      isActive: supplier.isActive,
    });
    setFormOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Campo requerido', description: 'El nombre del proveedor es obligatorio', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      if (editSupplier) {
        await updateSupplier(editSupplier.id, formData);
        toast({ title: 'Proveedor actualizado', description: `Se guardaron los cambios de ${formData.name}` });
      } else {
        await createSupplier(formData);
        toast({ title: 'Proveedor creado', description: `Se registró a ${formData.name}` });
      }
      setFormOpen(false);
      await loadSuppliers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      await deleteSupplier(id);
      toast({ title: 'Proveedor eliminado', description: 'Se eliminó el registro correctamente' });
      setDeleteConfirm(null);
      await loadSuppliers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleViewSupplier = async (supplier: Supplier) => {
    try {
      setDetailLoading(true);
      setDetailOpen(true);
      const detail = await fetchSupplier(supplier.id);
      setDetailSupplier(detail);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* eBay Account Banner */}
      {ebayStatus?.connected && !ebayCardDismissed && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">eBay — Cuenta Conectada</span>
                <Badge variant="outline" className="bg-emerald-100/60 text-emerald-800 border-emerald-300 font-semibold text-[10px] px-1.5 py-0">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                  Conectado como {ebayStatus.username || 'gozustrike'}
                </Badge>
              </div>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                Seguimiento de compras, 52 proveedores sincronizados y enlaces de compra en tiempo real.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEbayCardDismissed(true)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Proveedores & Radar de Ofertas eBay
                </h2>
                {unreadCount > 0 && (
                  <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1 animate-pulse text-xs">
                    <Flame className="h-3 w-3" />
                    {unreadCount} Nuevas Ofertas
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Buscador en tiempo real con pre-rellenados basados en tus compras, descuentos activos y compra directa sin errores 404.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={handleScanAll}
            disabled={scanningAll}
            className="gap-1.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-bold text-xs shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanningAll ? 'animate-spin' : ''}`} />
            {scanningAll ? 'Escaneando Ofertas...' : '🔍 Buscar Ofertas Ahora'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setTrackerModalOpen(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            Nuevo Buscador
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenCreateSupplier}
            className="gap-1.5 text-xs font-semibold"
          >
            <Store className="h-3.5 w-3.5" />
            Nuevo Proveedor
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Buttons */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Button
          size="sm"
          variant={activeTab === 'radar' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('radar')}
          className={`h-8 text-xs font-bold gap-1.5 ${
            activeTab === 'radar' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-muted-foreground'
          }`}
        >
          <Flame className="h-3.5 w-3.5 text-amber-500" />
          <span>Radar de Ofertas & Descuentos</span>
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900">
            {allDeals.length}
          </Badge>
        </Button>

        <Button
          size="sm"
          variant={activeTab === 'proveedores' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('proveedores')}
          className={`h-8 text-xs font-bold gap-1.5 ${
            activeTab === 'proveedores' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-muted-foreground'
          }`}
        >
          <Store className="h-3.5 w-3.5 text-emerald-600" />
          <span>Directorio de Proveedores eBay</span>
          <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
            {suppliers.length}
          </Badge>
        </Button>

        <Button
          size="sm"
          variant={activeTab === 'alertas' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('alertas')}
          className={`h-8 text-xs font-bold gap-1.5 ${
            activeTab === 'alertas' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-muted-foreground'
          }`}
        >
          <Bell className="h-3.5 w-3.5 text-purple-600" />
          <span>Alertas & Notificaciones</span>
          {unreadCount > 0 && (
            <Badge className="ml-1 text-[10px] px-1.5 py-0 bg-rose-600 text-white">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: RADAR DE OFERTAS & DESCUENTOS EN TIEMPO REAL
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'radar' && (
        <div className="space-y-4">
          {/* BARRA DE PLANTILLAS RÁPIDAS BASADAS EN COMPRAS REALES */}
          <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-emerald-500/10 border border-amber-200 dark:border-amber-900/50 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-600 fill-amber-500" />
                Plantillas Rápidas con Pre-rellenados de tus Compras (1-Clic para buscar o rastrear):
              </span>
              <span className="text-[10px] text-muted-foreground font-medium">Precios reales de compra</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {QUICK_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-card hover:bg-amber-50 dark:hover:bg-amber-950/60 border border-border hover:border-amber-400 text-xs font-semibold text-foreground transition-all shrink-0 cursor-pointer shadow-2xs group"
                >
                  <span>{tmpl.label}</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-amber-100/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 font-mono">
                    {tmpl.badge}
                  </Badge>
                </button>
              ))}
            </div>
          </div>

          {/* BUSCADOR DE PROVEEDORES EBAY EN TIEMPO REAL */}
          <Card className="p-3.5 bg-card border shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-emerald-600" />
                <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">
                  Buscador de Proveedores eBay en Tiempo Real
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Abre directamente los resultados reales en eBay con filtro Cómpralo Ya (Buy It Now) y menor precio
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              {/* Supplier Select */}
              <div className="sm:col-span-4 space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Tienda / Proveedor de eBay</Label>
                <Select value={liveSeller} onValueChange={setLiveSeller}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="all">🔍 Todos los Vendedores de eBay</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.name.toLowerCase()}>
                        {s.name} ({s.totalOrders} compras)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Keywords Input */}
              <div className="sm:col-span-5 space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Palabras Clave del Producto</Label>
                <Input
                  value={liveKeywords}
                  onChange={(e) => setLiveKeywords(e.target.value)}
                  placeholder="ej: iPad Pro 10.5 A1701 64GB"
                  className="h-8 text-xs font-mono bg-background"
                />
              </div>

              {/* Max Price */}
              <div className="sm:col-span-1 space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Max $</Label>
                <Input
                  type="number"
                  value={liveMaxPrice}
                  onChange={(e) => setLiveMaxPrice(e.target.value)}
                  placeholder="110"
                  className="h-8 text-xs font-mono text-center bg-background"
                />
              </div>

              {/* Action Buttons */}
              <div className="sm:col-span-2 flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => handleLaunchLiveEbay(liveSeller, liveKeywords, liveMaxPrice)}
                  className="flex-1 h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-900 gap-1 shadow-2xs"
                  title="Abrir búsqueda en vivo en eBay"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Ver eBay</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTrackerForm({
                      title: `${liveKeywords} en ${liveSeller === 'all' ? 'eBay' : liveSeller}`,
                      keywords: liveKeywords,
                      sellerLink: liveSeller !== 'all' ? `https://www.ebay.com/str/${liveSeller}` : '',
                      supplierId: '',
                      maxPriceUsd: liveMaxPrice,
                      minDiscountPct: '15',
                      condition: 'Used',
                      category: 'Tablets',
                      notificationsEnabled: true,
                    });
                    setTrackerModalOpen(true);
                  }}
                  className="h-8 px-2 text-xs font-semibold"
                  title="Guardar como buscador continuo"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Section: Buscadores Configurados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Buscadores de Ofertas Activos en Base de Datos</h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                  {trackers.length} Guardados
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTrackerModalOpen(true)}
                className="text-xs text-primary hover:text-primary font-semibold h-7 gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear Nuevo Buscador
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {trackers.map((t) => (
                <Card key={t.id} className="p-3 bg-card border hover:border-primary/40 transition-colors shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-xs text-foreground line-clamp-1" title={t.title}>
                        {t.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5 line-clamp-1" title={t.keywords}>
                        🔍 {t.keywords}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 font-bold bg-amber-50 text-amber-800 border-amber-300">
                      ≥{t.minDiscountPct || 10}% OFF
                    </Badge>
                  </div>

                  <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                    <div className="truncate max-w-[130px]">
                      {t.sellerUsername ? (
                        <a
                          href={`https://www.ebay.com/str/${t.sellerUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1 truncate"
                        >
                          <Store className="h-3 w-3 shrink-0" />
                          <span>{t.sellerUsername}</span>
                        </a>
                      ) : (
                        <span className="text-slate-500">Todos los vendedores</span>
                      )}
                    </div>
                    {t.maxPriceUsd && (
                      <span className="font-semibold text-foreground font-mono">
                        Max: ${t.maxPriceUsd}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-center justify-between pt-1">
                    <button
                      onClick={() => handleLaunchLiveEbay(t.sellerUsername || 'all', t.keywords, t.maxPriceUsd ? String(t.maxPriceUsd) : '')}
                      className="text-[11px] text-blue-600 hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <span>Abrir eBay</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleScanSingleTracker(t.id)}
                      disabled={scanningId === t.id}
                      className="h-6 px-2 text-[10px] font-semibold gap-1"
                    >
                      <RefreshCw className={`h-2.5 w-2.5 ${scanningId === t.id ? 'animate-spin' : ''}`} />
                      Escanear
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Section: Feed de Ofertas Detectadas */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 mr-1">
                  <Filter className="h-3.5 w-3.5 text-primary" />
                  Filtrar Ofertas:
                </span>
                <Button
                  size="sm"
                  variant={dealFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setDealFilter('all')}
                  className="h-7 text-xs font-medium"
                >
                  Todas ({allDeals.length})
                </Button>
                <Button
                  size="sm"
                  variant={dealFilter === 'discount_20' ? 'default' : 'outline'}
                  onClick={() => setDealFilter('discount_20')}
                  className="h-7 text-xs font-medium gap-1 text-emerald-700 dark:text-emerald-300"
                >
                  <Flame className="h-3 w-3 text-amber-500" />
                  ≥ 20% OFF
                </Button>
                <Button
                  size="sm"
                  variant={dealFilter === 'coupon' ? 'default' : 'outline'}
                  onClick={() => setDealFilter('coupon')}
                  className="h-7 text-xs font-medium gap-1 text-purple-700 dark:text-purple-300"
                >
                  <Tag className="h-3 w-3" />
                  Con Cupones
                </Button>
                <Button
                  size="sm"
                  variant={dealFilter === 'starred' ? 'default' : 'outline'}
                  onClick={() => setDealFilter('starred')}
                  className="h-7 text-xs font-medium gap-1 text-yellow-600"
                >
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  Favoritos
                </Button>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={dealSearch}
                  onChange={(e) => setDealSearch(e.target.value)}
                  placeholder="Buscar en ofertas..."
                  className="h-7 pl-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* Deals Grid */}
            {filteredDeals.length === 0 ? (
              <div className="p-12 text-center border rounded-lg bg-card text-muted-foreground">
                <Flame className="h-10 w-10 mx-auto opacity-30 mb-2" />
                <p className="font-semibold text-sm">No se encontraron ofertas con este filtro.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Haz clic en "Buscar Ofertas Ahora" o selecciona una de las plantillas rápidas.
                </p>
                <Button
                  size="sm"
                  onClick={handleScanAll}
                  className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  🔍 Escanear Ahora
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredDeals.map((deal) => {
                  const landedCostPen = deal.currentPriceUsd * 3.40;
                  const savingsUsd = deal.originalPriceUsd ? deal.originalPriceUsd - deal.currentPriceUsd : 0;
                  const buyNowUrl = getBuyNowUrl(deal);

                  return (
                    <Card
                      key={deal.id}
                      className="p-3.5 bg-card border hover:border-emerald-500/50 transition-all flex flex-col justify-between shadow-xs group"
                    >
                      <div>
                        {/* Top Bar: Badges & Star */}
                        <div className="flex items-center justify-between gap-2 pb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-1.5 py-0 gap-0.5 shadow-2xs">
                              <TrendingDown className="h-3 w-3" />
                              {deal.discountPct ? `${deal.discountPct}% OFF` : 'OFERTA'}
                            </Badge>
                            {deal.couponCode && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 font-mono text-[10px] px-1.5 py-0">
                                Cupón: {deal.couponCode}
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {deal.condition}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleStarDeal(deal)}
                              className="p-1 text-muted-foreground hover:text-yellow-500 transition-colors"
                              title={deal.isStarred ? 'Quitar de favoritos' : 'Marcar favorito'}
                            >
                              <Star className={`h-4 w-4 ${deal.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                            </button>
                            <button
                              onClick={() => handleDismissDeal(deal.id)}
                              className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                              title="Descartar oferta"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Title & Seller Info */}
                        <div className="space-y-1">
                          <a
                            href={buyNowUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-xs text-foreground hover:text-primary hover:underline line-clamp-2 leading-snug"
                            title={deal.title}
                          >
                            {deal.title}
                          </a>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>Tienda:</span>
                            <a
                              href={`https://www.ebay.com/str/${deal.sellerUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-semibold flex items-center gap-0.5"
                            >
                              <Store className="h-3 w-3" />
                              <span>{deal.sellerUsername}</span>
                            </a>
                            <span className="text-[10px] text-slate-400">({deal.sellerFeedback})</span>
                          </div>
                        </div>

                        {/* Promo Description */}
                        {deal.promoDescription && (
                          <div className="mt-2 p-1.5 rounded bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                            <span className="truncate">{deal.promoDescription}</span>
                            {deal.couponCode && (
                              <button
                                onClick={() => handleCopy(deal.couponCode!, deal.id)}
                                className="ml-auto text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:underline shrink-0"
                              >
                                {copiedCode === deal.id ? '✓ Copiado' : 'Copiar Cupón'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Pricing Grid */}
                        <div className="mt-3 p-2.5 rounded-lg bg-muted/40 border">
                          <div className="flex items-baseline justify-between">
                            <span className="text-xs text-muted-foreground">Precio en Oferta:</span>
                            <div className="flex items-baseline gap-1.5">
                              {deal.originalPriceUsd && (
                                <span className="text-xs text-muted-foreground line-through font-mono">
                                  ${deal.originalPriceUsd.toFixed(2)}
                                </span>
                              )}
                              <span className="text-lg font-extrabold text-foreground font-mono">
                                ${deal.currentPriceUsd.toFixed(2)} USD
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1 border-t mt-1.5 text-muted-foreground">
                            <span>Llegada a Perú (3.40):</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">
                              S/ {landedCostPen.toFixed(2)} PEN
                            </span>
                          </div>

                          {savingsUsd > 0 && (
                            <div className="flex items-center justify-between text-[11px] pt-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                              <span>Ahorro Directo:</span>
                              <span className="font-bold font-mono">-${savingsUsd.toFixed(2)} USD</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-3 pt-2 border-t space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => window.open(buyNowUrl, '_blank')}
                            className="flex-1 h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-900 gap-1 shadow-2xs"
                            title="Abrir resultados reales y activos en eBay (Cómpralo Ya)"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            <span>Ver Ofertas en eBay</span>
                            <ExternalLink className="h-3 w-3 opacity-70 ml-0.5" />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleImportDealToProduct(deal)}
                            disabled={importingDealId === deal.id}
                            className="h-8 text-xs font-semibold gap-1 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                            title="Pre-registrar este producto en compras e inventario"
                          >
                            <Package className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Registrar</span>
                          </Button>
                        </div>

                        <div className="flex items-center justify-between text-[11px] px-1 text-muted-foreground">
                          <a
                            href={`https://www.ebay.com/str/${deal.sellerUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 text-[10px]"
                          >
                            <Store className="h-2.5 w-2.5" />
                            <span>Ver Tienda {deal.sellerUsername}</span>
                          </a>
                          <span className="text-[10px] text-slate-400">Garantía eBay</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: DIRECTORIO DE PROVEEDORES EBAY (52)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'proveedores' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/30 p-2.5 rounded-lg border">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar proveedor por nombre, tienda eBay, contacto..."
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Categorías</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[70vh]">
              <Table className="text-xs">
                <TableHeader className="bg-muted/70 sticky top-0 z-10 text-[11px]">
                  <TableRow>
                    <TableHead className="w-[40px] text-center font-bold">#</TableHead>
                    <TableHead className="min-w-[180px]">Proveedor / Tienda eBay</TableHead>
                    <TableHead className="w-[100px] text-center">Calificación</TableHead>
                    <TableHead className="w-[90px] text-center font-bold">Compras</TableHead>
                    <TableHead className="w-[110px] text-right font-bold text-foreground">Total Invertido</TableHead>
                    <TableHead className="w-[120px]">Categoría</TableHead>
                    <TableHead className="w-[100px] text-center">País</TableHead>
                    <TableHead className="w-[180px] text-center">Acciones & Radar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                        <Store className="h-8 w-8 mx-auto opacity-30 mb-2" />
                        <p className="font-semibold text-sm">No se encontraron proveedores.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    suppliers
                      .filter((s) => {
                        const matchSearch =
                          !search ||
                          s.name.toLowerCase().includes(search.toLowerCase()) ||
                          s.website.toLowerCase().includes(search.toLowerCase());
                        const matchCat = categoryFilter === 'all' || s.category === categoryFilter;
                        return matchSearch && matchCat;
                      })
                      .map((s, idx) => (
                        <TableRow key={s.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="text-center font-mono text-muted-foreground">
                            {idx + 1}
                          </TableCell>

                          <TableCell>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              <span>{s.name}</span>
                              {s.url && (
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                  title="Ver tienda en eBay"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground line-clamp-1">
                              {s.website || s.url}
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            <RatingStars rating={s.rating || 5} />
                          </TableCell>

                          <TableCell className="text-center font-mono font-bold">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 dark:bg-slate-900">
                              {s.totalOrders} órdenes
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right font-mono font-bold text-foreground">
                            ${Number(s.totalSpentUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                              {CATEGORY_LABELS[s.category] || s.category}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-center">
                            <span>🇺🇸 US</span>
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTrackSupplier(s)}
                                className="h-7 px-2 text-[10px] font-bold text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-300 gap-1"
                                title="Crear buscador de ofertas para este proveedor"
                              >
                                <Flame className="h-3 w-3 text-amber-500" />
                                <span>Rastrear</span>
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleViewSupplier(s)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="Ver enlaces y productos"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenEditSupplier(s)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="Editar datos"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: CENTRO DE ALERTAS & NOTIFICACIONES
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'alertas' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b">
            <div>
              <h3 className="text-sm font-bold text-foreground">Historial de Notificaciones de Ofertas</h3>
              <p className="text-xs text-muted-foreground">
                Alertas automáticas emitidas al detectar rebajas de precio o cupones en tus productos monitoreados.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleScanAll}
              disabled={scanningAll}
              className="text-xs font-semibold gap-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${scanningAll ? 'animate-spin' : ''}`} />
              Verificar Ahora
            </Button>
          </div>

          <div className="space-y-2.5">
            {allDeals.length === 0 ? (
              <div className="p-12 text-center border rounded-lg bg-card text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto opacity-30 mb-2" />
                <p className="font-semibold text-sm">No hay alertas de promociones recientes.</p>
              </div>
            ) : (
              allDeals.map((deal) => {
                const buyUrl = getBuyNowUrl(deal);

                return (
                  <div
                    key={deal.id}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 shrink-0">
                        <Flame className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-foreground">{deal.title}</span>
                          <Badge className="bg-emerald-600 text-white text-[10px] px-1 py-0 font-bold">
                            {deal.discountPct ? `${deal.discountPct}% OFF` : 'OFERTA'}
                          </Badge>
                          {deal.couponCode && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-[10px] px-1 py-0 font-mono">
                              Cupón: {deal.couponCode}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                          <span>Tienda: <strong className="text-foreground">{deal.sellerUsername}</strong></span>
                          <span>•</span>
                          <span>Ahora: <strong className="text-foreground font-mono">${deal.currentPriceUsd.toFixed(2)}</strong></span>
                          {deal.originalPriceUsd && (
                            <>
                              <span>•</span>
                              <span>Antes: <span className="line-through font-mono">${deal.originalPriceUsd.toFixed(2)}</span></span>
                            </>
                          )}
                          <span>•</span>
                          <span className="text-[10px]">Llegada a Perú: S/ {(deal.currentPriceUsd * 3.40).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => window.open(buyUrl, '_blank')}
                        className="h-7 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-900 gap-1"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        <span>Ver Ofertas</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleImportDealToProduct(deal)}
                        disabled={importingDealId === deal.id}
                        className="h-7 text-xs font-semibold gap-1"
                      >
                        <Package className="h-3 w-3 text-emerald-600" />
                        <span>Registrar</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: NUEVO BUSCADOR DE OFERTAS & ENLACES EBAY
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={trackerModalOpen} onOpenChange={setTrackerModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Flame className="h-4 w-4 text-amber-500" />
              Nuevo Buscador de Ofertas & Enlaces de Proveedores
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configura alertas automáticas de descuentos y promociones en eBay para tus productos favoritos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Título del Buscador *</Label>
              <Input
                placeholder="ej: iPad 9na Gen 64GB en Oferta"
                value={trackerForm.title}
                onChange={(e) => setTrackerForm({ ...trackerForm, title: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Palabras Clave de Búsqueda (eBay) *</Label>
              <Input
                placeholder="ej: iPad 9th Gen 64GB Wi-Fi"
                value={trackerForm.keywords}
                onChange={(e) => setTrackerForm({ ...trackerForm, keywords: e.target.value })}
                className="h-8 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Términos exactos con los que el buscador rastreará las publicaciones en eBay.
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Enlace o Nombre del Proveedor de eBay (Opcional)</Label>
              <Input
                placeholder="https://www.ebay.com/str/itsworthmore o nombre de usuario"
                value={trackerForm.sellerLink}
                onChange={(e) => setTrackerForm({ ...trackerForm, sellerLink: e.target.value })}
                className="h-8 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Pega la URL de la tienda del proveedor para limitar la búsqueda a ese vendedor específico.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Precio Máximo ($ USD)</Label>
                <Input
                  type="number"
                  placeholder="ej: 160"
                  value={trackerForm.maxPriceUsd}
                  onChange={(e) => setTrackerForm({ ...trackerForm, maxPriceUsd: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Mínimo Descuento (%)</Label>
                <Select
                  value={trackerForm.minDiscountPct}
                  onValueChange={(val) => setTrackerForm({ ...trackerForm, minDiscountPct: val })}
                >
                  <SelectTrigger className="h-8 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">≥ 5% Descuento</SelectItem>
                    <SelectItem value="10">≥ 10% Descuento</SelectItem>
                    <SelectItem value="15">≥ 15% Descuento</SelectItem>
                    <SelectItem value="20">≥ 20% Descuento</SelectItem>
                    <SelectItem value="25">≥ 25% Descuento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Categoría</Label>
                <Select
                  value={trackerForm.category}
                  onValueChange={(val) => setTrackerForm({ ...trackerForm, category: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tablets">Tablets / iPads</SelectItem>
                    <SelectItem value="Laptops">Laptops / MacBooks</SelectItem>
                    <SelectItem value="Phones">Celulares / iPhones</SelectItem>
                    <SelectItem value="Electronics">Electrónica General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Condición</Label>
                <Select
                  value={trackerForm.condition}
                  onValueChange={(val) => setTrackerForm({ ...trackerForm, condition: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Used">Usado / Refurbished</SelectItem>
                    <SelectItem value="New">Nuevo</SelectItem>
                    <SelectItem value="All">Cualquiera</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTrackerModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTracker}
              disabled={savingTracker}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
            >
              {savingTracker ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Guardar Buscador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: NUEVO / EDITAR PROVEEDOR
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4 text-emerald-600" />
              {editSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor de eBay'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Nombre del Proveedor / Tienda *</Label>
              <Input
                placeholder="ej: ItsWorthMore, WikiWoo, VipOutlet"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">URL de Tienda en eBay</Label>
              <Input
                placeholder="https://www.ebay.com/str/..."
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">URL de Perfil / Usuario eBay</Label>
              <Input
                placeholder="https://www.ebay.com/usr/..."
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">País</Label>
                <Select
                  value={formData.country}
                  onValueChange={(val) => setFormData({ ...formData, country: val })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Calificación</Label>
                <div className="pt-1.5">
                  <RatingStars
                    rating={formData.rating || 5}
                    onRate={(r) => setFormData({ ...formData, rating: r })}
                    size="md"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Textarea
                placeholder="Detalles sobre envíos, garantías, calidad típica..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveSupplier} disabled={saving} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar Proveedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: DETALLE Y ENLACES DE PROVEEDOR
      ───────────────────────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
              <p className="text-xs text-muted-foreground">Cargando enlaces y estadísticas...</p>
            </div>
          ) : detailSupplier ? (
            <div>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-emerald-600" />
                    <span>{detailSupplier.name}</span>
                    <RatingStars rating={detailSupplier.rating || 5} />
                  </DialogTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDetailOpen(false);
                      handleTrackSupplier(detailSupplier);
                    }}
                    className="h-7 text-xs font-bold text-amber-700 hover:bg-amber-50 border-amber-300 gap-1"
                  >
                    <Flame className="h-3 w-3 text-amber-500" />
                    <span>Rastrear Ofertas</span>
                  </Button>
                </div>
                <DialogDescription className="text-xs">
                  {detailSupplier.website || detailSupplier.url}
                </DialogDescription>
              </DialogHeader>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-2 my-3 p-2.5 rounded-lg bg-muted/40 border text-xs">
                <div>
                  <span className="text-muted-foreground text-[10px]">Total Compras:</span>
                  <p className="font-bold text-foreground font-mono">{detailSupplier.totalOrders} órdenes</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Total Invertido:</span>
                  <p className="font-bold text-emerald-600 font-mono">
                    ${Number(detailSupplier.totalSpentUsd || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">País de Origen:</span>
                  <p className="font-bold text-foreground">🇺🇸 Estados Unidos</p>
                </div>
              </div>

              {/* Supplier Links Section */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    Enlaces Guardados ({detailSupplier.links?.length || 0})
                  </h4>
                </div>

                <div className="space-y-1.5">
                  {(detailSupplier.links || []).map((link) => (
                    <div
                      key={link.id}
                      className="p-2 rounded border bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="truncate flex-1">
                        <span className="font-semibold text-foreground truncate block">{link.title}</span>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline truncate block"
                        >
                          {link.url}
                        </a>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(link.url, '_blank')}
                        className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
