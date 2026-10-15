'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Smartphone,
  Download,
  Printer,
  Copy,
  Check,
  Search,
  ExternalLink,
  Laptop,
  Tablet,
  Sparkles,
  Layers,
  Edit2,
  RefreshCw,
  ImageIcon,
  Camera,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  getProductCatalogInfo,
  generateWhatsAppMessage,
  CatalogItemInfo,
} from '@/lib/catalog-helper';

interface ProductItem {
  id: string;
  orderNumber: string;
  description: string;
  model?: string;
  capacity?: string;
  color?: string;
  condition?: string;
  status?: string;
  importerProfile?: string;
  purchasePriceUSD?: number;
  totalCostPEN?: number;
  salePricePEN?: number;
  suggestedPricePEN?: number;
}

export function CatalogoTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'laptops' | 'tablets' | 'accesorios'>('all');
  const [locationFilter, setLocationFilter] = useState<'all' | 'USA' | 'TRANSITO_USA'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Per-card active image index (0, 1, or 2)
  const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>({});
  // Timestamp cache buster for images replaced
  const [imageTimestamps, setImageTimestamps] = useState<Record<string, number>>({});

  // Edit price dialog
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [savingPrice, setSavingPrice] = useState(false);

  // Search photos dialog
  const [searchPhotoTarget, setSearchPhotoTarget] = useState<{
    modelKey: string;
    productTitle: string;
    defaultQuery: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ url: string; thumbnail: string; title: string }>>([]);
  const [searchingPhotos, setSearchingPhotos] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<1 | 2 | 3>(1);
  const [savingSlotImage, setSavingSlotImage] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState('');

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products?archived=false');
      if (!res.ok) throw new Error('Error al cargar productos');
      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los productos del catálogo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filtered products with catalog metadata
  const enrichedProducts = useMemo(() => {
    return products.map((p) => {
      const info = getProductCatalogInfo({
        id: p.id,
        orderNumber: p.orderNumber,
        description: p.description,
        model: p.model,
        capacity: p.capacity,
        color: p.color,
        salePricePen: p.salePricePEN,
        suggestedPricePen: p.suggestedPricePEN,
        totalCostPen: p.totalCostPEN,
        purchasePriceUsd: p.purchasePriceUSD,
      });
      return { product: p, info };
    });
  }, [products]);

  const filteredItems = useMemo(() => {
    return enrichedProducts.filter(({ product, info }) => {
      // Category filter
      if (categoryFilter === 'laptops' && info.category !== 'Laptops & MacBooks') return false;
      if (categoryFilter === 'tablets' && info.category !== 'iPads & Tablets') return false;
      if (categoryFilter === 'accesorios' && info.category !== 'Accesorios') return false;

      // Location filter
      if (locationFilter !== 'all') {
        const prodStatus = product.status || '';
        if (locationFilter === 'USA' && prodStatus !== 'USA') return false;
        if (locationFilter === 'TRANSITO_USA' && prodStatus !== 'TRANSITO_USA') return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = info.commercialTitle.toLowerCase().includes(q);
        const matchesDesc = (product.description || '').toLowerCase().includes(q);
        const matchesOrder = (product.orderNumber || '').toLowerCase().includes(q);
        const matchesSpecs = `${info.cpuSpecs} ${info.storageSpecs} ${info.ramSpecs}`.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesOrder && !matchesSpecs) return false;
      }

      return true;
    });
  }, [enrichedProducts, categoryFilter, locationFilter, search]);

  const handleCopyWhatsApp = (item: CatalogItemInfo, id: string, currentImg: string) => {
    const text = generateWhatsAppMessage({ ...item, referenceImage: currentImg });
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
    toast({
      title: '📋 Ficha copiada para WhatsApp',
      description: 'El texto con formato y emojis está listo para pegar en el chat del cliente.',
    });
  };

  const handleOpenWhatsApp = (item: CatalogItemInfo, currentImg: string) => {
    const text = generateWhatsAppMessage({ ...item, referenceImage: currentImg });
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSavePrice = async () => {
    if (!editingProduct) return;
    try {
      setSavingPrice(true);
      const res = await fetch(`/api/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salePricePEN: newPrice,
          suggestedPricePEN: newPrice,
        }),
      });

      if (!res.ok) throw new Error('Error al actualizar precio');

      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? { ...p, salePricePEN: newPrice, suggestedPricePEN: newPrice }
            : p
        )
      );

      toast({
        title: '✅ Precio actualizado',
        description: `Nuevo precio para ${editingProduct.orderNumber}: S/ ${newPrice} PEN`,
      });
      setEditingProduct(null);
    } catch (e: any) {
      toast({
        title: 'Error',
        description: e.message || 'No se pudo guardar el nuevo precio',
        variant: 'destructive',
      });
    } finally {
      setSavingPrice(false);
    }
  };

  // Helper to get modelKey from referenceImage (e.g. '/catalog/macbook-pro-16-1.png' -> 'macbook-pro-16')
  const getModelKey = (img: string) => {
    const match = img.match(/\/catalog\/([a-z0-9-]+?)(?:-\d)?\.png/i);
    return match ? match[1] : 'macbook-pro-16';
  };

  const handleOpenSearchPhotos = (info: CatalogItemInfo) => {
    const modelKey = getModelKey(info.referenceImage);
    setSearchPhotoTarget({
      modelKey,
      productTitle: info.commercialTitle,
      defaultQuery: info.commercialTitle,
    });
    setSearchQuery(info.commercialTitle);
    setSearchResults([]);
    setSelectedSlot(1);
    setCustomImageUrl('');
  };

  const handleSearchGoogleImages = async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearchingPhotos(true);
      const res = await fetch(`/api/catalog/search-images?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      setSearchResults(data.results || []);
      if (!data.results || data.results.length === 0) {
        toast({
          title: 'Sin resultados',
          description: 'Prueba con otro término de búsqueda más específico (ej: macbook pro 16 touch bar).',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error de búsqueda',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSearchingPhotos(false);
    }
  };

  const handleSelectImageForSlot = async (imgUrl: string) => {
    if (!searchPhotoTarget) return;
    try {
      setSavingSlotImage(true);
      const res = await fetch('/api/catalog/save-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelKey: searchPhotoTarget.modelKey,
          slot: selectedSlot,
          imageUrl: imgUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar imagen');

      // Update timestamp to bust image cache
      setImageTimestamps((prev) => ({
        ...prev,
        [`${searchPhotoTarget.modelKey}-${selectedSlot}`]: Date.now(),
      }));

      toast({
        title: `✅ Foto ${selectedSlot} guardada con éxito`,
        description: `Se descargó y asignó a ${searchPhotoTarget.modelKey}`,
      });
      setSearchPhotoTarget(null);
    } catch (err: any) {
      toast({
        title: 'Error al asignar imagen',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSavingSlotImage(false);
    }
  };

  // Category counts
  const counts = useMemo(() => {
    let laptops = 0;
    let tablets = 0;
    let accesorios = 0;
    enrichedProducts.forEach(({ info }) => {
      if (info.category === 'Laptops & MacBooks') laptops++;
      else if (info.category === 'iPads & Tablets') tablets++;
      else accesorios++;
    });
    return { all: enrichedProducts.length, laptops, tablets, accesorios };
  }, [enrichedProducts]);

  return (
    <div className="space-y-6">
      {/* ULTRA-PREMIUM LUXURY PRINT COVER (PAGE 1) */}
      <div className="hidden print:flex flex-col justify-between min-h-[95vh] p-8 bg-slate-950 text-white rounded-3xl border-2 border-emerald-500/40 catalog-page-break relative overflow-hidden">
        {/* Ambient gradients */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Cover Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg font-black text-slate-950 text-2xl tracking-tighter">
              iT
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white uppercase">
                iTech Perú
              </h2>
              <p className="text-xs text-emerald-400 font-semibold tracking-wider uppercase">
                Importaciones Directas USA • Mayorista & Retail
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider">
              Edición Oficial 2026
            </span>
            <p className="text-[11px] text-slate-400 mt-1">Stock Miami & Lima</p>
          </div>
        </div>

        {/* Cover Center Content */}
        <div className="relative z-10 my-auto py-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/10 text-emerald-300 text-xs font-semibold tracking-wide border border-white/10">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            CATÁLOGO EJECUTIVO & OPORTUNIDADES TIKTOK LIVE
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
            TECNOLOGÍA APPLE & <br />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              EQUIPOS PREMIUM DE ALTO RENDIMIENTO
            </span>
          </h1>

          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Equipos 100% originales seleccionados e inspeccionados en 30 puntos técnicos antes de su embarque desde Miami. Precios de oportunidad exclusiva para compras directas y transmisiones en vivo por TikTok Live.
          </p>

          {/* 4 Trust Pillars */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                🛡️ Garantía Escrita 3 Meses
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Soporte técnico directo, respaldo posventa y cambio inmediato ante cualquier defecto de fábrica.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                💎 Grado A Certificado
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Chasis impecable, baterías con óptima salud y números de serie verificables en Apple Check Coverage.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                🎥 En Vivo por TikTok Live
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Mostramos el equipo físico exacto en pantalla antes de tu confirmación de compra y despacho.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
              <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                📦 Envíos Asegurados a Todo el Perú
              </div>
              <p className="text-xs text-slate-300 leading-snug">
                Entregas en Lima y envíos a provincia vía Shalom y Olva Courier con código de rastreo.
              </p>
            </div>
          </div>
        </div>

        {/* Cover Channels & Footer */}
        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs">
          <div className="space-y-1">
            <p className="text-slate-400">Atención Directa & Separaciones:</p>
            <p className="text-lg font-black text-emerald-400">📲 WhatsApp: +51 924 967 876</p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-slate-400">Tienda Web Oficial:</p>
            <p className="font-bold text-white text-sm">🌐 www.itechperu.shop</p>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY RUNNING HEADER (PAGE 2+) */}
      <div className="hidden print:flex items-center justify-between border-b pb-3 mb-5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="font-black text-slate-900 tracking-tight text-sm">iTech Perú</span>
          <span>•</span>
          <span className="text-emerald-700 font-semibold">Catálogo Oficial TikTok Live 2026</span>
          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
            Garantía 3 Meses Directa
          </span>
        </div>
        <div className="font-semibold text-slate-800 text-right">
          <p>Pedidos WhatsApp: <span className="text-emerald-700 font-bold">+51 924 967 876</span></p>
          <p className="text-[10px] text-slate-500 font-mono">www.itechperu.shop</p>
        </div>
      </div>

      {/* SCREEN TOP BAR */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 text-white shadow-xl border border-emerald-900/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Smartphone className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Catálogo TikTok Live & WhatsApp Business
            </h2>
            <Badge className="bg-emerald-500 text-slate-950 font-bold text-xs uppercase hover:bg-emerald-400">
              {counts.all} Equipos
            </Badge>
          </div>
          <p className="text-xs text-emerald-200/80 max-w-2xl">
            Fotos de catálogo reales con 3 vistas por modelo (Frontal abierta con pantalla y Touch Bar encendidos, Ángulo y Teclado). Fichas listas para responder prospectos por WhatsApp en 1 clic.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchProducts}
            disabled={loading}
            className="border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs h-9 gap-1.5 font-semibold"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir / Guardar PDF
          </Button>

          <a href="/api/catalog/export-whatsapp" download="catalogo_whatsapp_business.csv">
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs h-9 gap-1.5 shadow-md"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar CSV WhatsApp Business
            </Button>
          </a>
        </div>
      </div>

      {/* SANITY CMS LIVE INTEGRATION BANNER */}
      <div className="print:hidden flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-white tracking-wide">
                🌐 Conectado en Tiempo Real con www.itechperu.shop
              </span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                Sanity CMS • Dataset: production
              </Badge>
            </div>
            <p className="text-[11px] text-slate-300">
              11 productos sincronizados y publicados con imágenes Sanity CDN de alta resolución y precios oficiales.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://www.itechperu.shop"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-colors"
          >
            <span>Ver Tienda Web</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          <a
            href="https://www.itechperu.shop/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 border border-white/20 text-xs font-semibold transition-colors"
          >
            <span>Sanity Studio</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="print:hidden flex flex-col md:flex-row gap-3 items-center justify-between bg-card p-3.5 rounded-xl border shadow-xs">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <Tabs
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as any)}
            className="w-full md:w-auto"
          >
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs gap-1.5 font-medium">
                <Layers className="h-3.5 w-3.5" />
                Todos ({counts.all})
              </TabsTrigger>
              <TabsTrigger value="laptops" className="text-xs gap-1.5 font-medium">
                <Laptop className="h-3.5 w-3.5 text-blue-600" />
                MacBooks & Laptops ({counts.laptops})
              </TabsTrigger>
              <TabsTrigger value="tablets" className="text-xs gap-1.5 font-medium">
                <Tablet className="h-3.5 w-3.5 text-emerald-600" />
                iPads & Tablets ({counts.tablets})
              </TabsTrigger>
              <TabsTrigger value="accesorios" className="text-xs gap-1.5 font-medium">
                <Package className="h-3.5 w-3.5 text-amber-600" />
                Accesorios ({counts.accesorios})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Location status toggle */}
          <div className="flex items-center gap-1 border-l pl-2 text-xs">
            <Button
              size="sm"
              variant={locationFilter === 'all' ? 'secondary' : 'ghost'}
              onClick={() => setLocationFilter('all')}
              className="h-8 text-xs px-2.5"
            >
              Todas Ubicaciones
            </Button>
            <Button
              size="sm"
              variant={locationFilter === 'USA' ? 'secondary' : 'ghost'}
              onClick={() => setLocationFilter('USA')}
              className="h-8 text-xs px-2.5 text-emerald-700 font-semibold"
            >
              🏢 En Miami
            </Button>
            <Button
              size="sm"
              variant={locationFilter === 'TRANSITO_USA' ? 'secondary' : 'ghost'}
              onClick={() => setLocationFilter('TRANSITO_USA')}
              className="h-8 text-xs px-2.5 text-blue-700 font-semibold"
            >
              ✈️ En Tránsito
            </Button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por modelo, RAM, disco..."
            className="pl-8 h-9 text-xs"
          />
        </div>
      </div>

      {/* CATALOG GRID */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 rounded-xl bg-muted/40 animate-pulse border" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-xl border bg-card text-muted-foreground space-y-2">
          <Package className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <p className="font-semibold text-sm">No se encontraron productos con los filtros seleccionados.</p>
          <p className="text-xs">Intenta cambiar la búsqueda o restablecer la categoría.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print:grid-cols-2 print:gap-4">
          {filteredItems.map(({ product, info }) => {
            const isDeliveredMiami = product.status === 'USA';
            const isCopied = copiedId === product.id;
            const modelKey = getModelKey(info.referenceImage);
            const activeIdx = activeImageIndices[product.id] ?? 0;
            const rawImg = info.images?.[activeIdx] || info.referenceImage;
            const ts = imageTimestamps[`${modelKey}-${activeIdx + 1}`];
            const currentImg = ts ? `${rawImg}?t=${ts}` : rawImg;

            return (
              <Card
                key={product.id}
                className="catalog-print-card overflow-hidden border hover:border-emerald-500/50 transition-all hover:shadow-lg flex flex-col justify-between bg-card group print:shadow-none print:border-slate-300 print:break-inside-avoid"
              >
                <div>
                  {/* Image container with Stock Reference badge & 3-angle switcher */}
                  <div className="relative w-full h-64 bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex flex-col items-center justify-between p-3 border-b overflow-hidden">
                    {/* Top row: Badges */}
                    <div className="w-full flex items-center justify-between z-10">
                      <Badge
                        variant="secondary"
                        className="bg-background/90 backdrop-blur-xs text-[10px] font-semibold text-foreground/80 border shadow-xs gap-1"
                      >
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        {activeIdx === 0 ? 'Foto Principal con Título' : `Vista Detallada (${activeIdx + 1}/3)`}
                      </Badge>

                      <div className="flex items-center gap-1.5">
                        <Badge
                          className={`text-[10px] font-bold ${
                            isDeliveredMiami
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {isDeliveredMiami ? '🏢 En Miami' : '✈️ En Tránsito'}
                        </Badge>
                      </div>
                    </div>

                    {/* Main Product Image (Centered) */}
                    <div className="flex-1 w-full flex items-center justify-center p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentImg}
                        alt={info.commercialTitle}
                        className="max-h-44 max-w-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300 rounded"
                      />
                    </div>

                    {/* 3 Clickable Thumbnails bar */}
                    <div className="print:hidden w-full flex items-center justify-between pt-1 border-t border-border/40 gap-1.5 z-10">
                      <div className="flex items-center gap-1.5">
                        {(info.images || [info.referenceImage]).map((thumb, idx) => {
                          const isActive = activeIdx === idx;
                          const thumbTs = imageTimestamps[`${modelKey}-${idx + 1}`];
                          const thumbSrc = thumbTs ? `${thumb}?t=${thumbTs}` : thumb;
                          const isLaptop = info.category === 'Laptops & MacBooks';
                          const label = idx === 0 ? 'Foto 1' : idx === 1 ? 'Ángulo' : isLaptop ? 'Teclado' : 'Posterior';

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                setActiveImageIndices((prev) => ({
                                  ...prev,
                                  [product.id]: idx,
                                }))
                              }
                              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                                isActive
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs scale-105'
                                  : 'bg-background/80 text-muted-foreground hover:bg-background border-border/60'
                              }`}
                            >
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Button to search or change photos */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 rounded"
                        title="Buscar o cambiar fotos de este modelo"
                        onClick={() => handleOpenSearchPhotos(info)}
                      >
                        <Camera className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Card Content */}
                  <CardContent className="p-4 space-y-3">
                    {/* Title */}
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                          {info.category} • {info.brand}
                        </p>
                        <Badge variant="outline" className="text-[10px] font-mono bg-background/80 text-foreground/70 uppercase">
                          {product.importerProfile || 'FABIO'}
                        </Badge>
                      </div>
                      <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-2 mt-0.5">
                        {info.commercialTitle}
                      </h3>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        Ord: {product.orderNumber}
                      </p>
                    </div>

                    {/* Specs Pills / Details */}
                    <div className="space-y-1.5 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/50">
                      <div className="flex items-start gap-1.5">
                        <span className="text-muted-foreground font-semibold shrink-0">🖥️ Pantalla:</span>
                        <span className="text-foreground line-clamp-1">{info.displaySpecs}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-muted-foreground font-semibold shrink-0">⚙️ Procesador:</span>
                        <span className="text-foreground line-clamp-1">{info.cpuSpecs}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-muted-foreground font-semibold shrink-0">🧠 Memoria:</span>
                        <span className="text-foreground font-bold">{info.ramSpecs}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-muted-foreground font-semibold shrink-0">💾 Almacenamiento:</span>
                        <span className="text-foreground font-bold">{info.storageSpecs}</span>
                      </div>
                      <div className="flex items-start gap-1.5 pt-0.5 border-t border-border/40">
                        <span className="text-muted-foreground font-semibold shrink-0">✨ Estado:</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium text-[11px] line-clamp-1">
                          {info.conditionLabel}
                        </span>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-[11px] text-muted-foreground line-through block">
                          S/ {info.regularPricePen}
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                            S/ {info.salePricePen}
                          </span>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                            PEN (Live)
                          </span>
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="print:hidden h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Editar precio de venta"
                        onClick={() => {
                          setEditingProduct(product);
                          setNewPrice(info.salePricePen);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Print-only WhatsApp Reservation Box */}
                    <div className="hidden print:block p-2 mt-2 pt-2 border-t border-slate-200 bg-slate-50 rounded-b text-center">
                      <p className="text-[10px] font-bold text-emerald-900 leading-tight">
                        📲 Pedidos & Separaciones: WhatsApp +51 924 967 876
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono">
                        Indicar Orden: {product.orderNumber} • Garantía 3 Meses iTech Perú
                      </p>
                    </div>
                  </CardContent>
                </div>

                {/* Footer Buttons (Hidden in Print) */}
                <div className="print:hidden p-3 pt-0 border-t bg-muted/10 grid grid-cols-2 gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyWhatsApp(info, product.id, currentImg)}
                    className="text-xs h-8 gap-1.5 border-emerald-600/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold"
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {isCopied ? '¡Copiado!' : 'Copiar WA'}
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleOpenWhatsApp(info, currentImg)}
                    className="text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    Enviar WA
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* SEARCH / CHANGE PHOTOS DIALOG */}
      <Dialog open={!!searchPhotoTarget} onOpenChange={(open) => !open && setSearchPhotoTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b bg-card">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-600" />
              <div>
                <DialogTitle className="text-base font-bold">
                  Buscador & Asignador de Fotos en Google / Web
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {searchPhotoTarget?.productTitle}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Slot selector: which of the 3 photos to update */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                ¿Qué posición de foto deseas reemplazar?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { slot: 1 as const, label: 'Foto 1: Frontal Abierta' },
                  { slot: 2 as const, label: 'Foto 2: Vista Ángulo' },
                  { slot: 3 as const, label: 'Foto 3: Teclado / Detalle' },
                ].map((item) => (
                  <Button
                    key={item.slot}
                    type="button"
                    size="sm"
                    variant={selectedSlot === item.slot ? 'default' : 'outline'}
                    onClick={() => setSelectedSlot(item.slot)}
                    className={`text-xs h-9 font-semibold ${
                      selectedSlot === item.slot ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                    }`}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Término de búsqueda de imagen:
              </label>
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ej: macbook pro 16 touch bar mercadolibre"
                  className="text-xs h-9"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchGoogleImages()}
                />
                <Button
                  onClick={handleSearchGoogleImages}
                  disabled={searchingPhotos || !searchQuery.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-4 shrink-0 font-bold"
                >
                  {searchingPhotos ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Search className="h-3.5 w-3.5 mr-1" />}
                  Buscar en Web
                </Button>
              </div>
            </div>

            {/* Search Results Visual Grid */}
            {searchingPhotos ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-28 rounded-lg bg-muted/50 animate-pulse border" />
                ))}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Haz clic en la foto que deseas asignar como Foto {selectedSlot}:</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {searchResults.length} fotos encontradas
                  </span>
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                  {searchResults.map((res, i) => (
                    <div
                      key={i}
                      onClick={() => !savingSlotImage && handleSelectImageForSlot(res.url)}
                      className="group relative h-28 rounded-lg border bg-slate-50 dark:bg-slate-900 p-2 flex items-center justify-center cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all overflow-hidden"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={res.thumbnail || res.url}
                        alt={res.title}
                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-emerald-950/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1 text-center">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 mb-1" />
                        <span className="text-[10px] font-bold">Asignar Foto {selectedSlot}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Direct URL input alternative */}
            <div className="pt-2 border-t space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                O pega la URL directa de una imagen web:
              </label>
              <div className="flex gap-2">
                <Input
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://.../imagen.png"
                  className="text-xs h-8"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSelectImageForSlot(customImageUrl)}
                  disabled={savingSlotImage || !customImageUrl.trim()}
                  className="text-xs h-8 shrink-0 font-semibold"
                >
                  Asignar URL
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-card">
            <Button size="sm" variant="outline" onClick={() => setSearchPhotoTarget(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT PRICE MODAL */}
      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              Modificar Precio de Venta (PEN)
            </DialogTitle>
          </DialogHeader>

          {editingProduct && (
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground line-clamp-2 font-medium">
                {editingProduct.description}
              </p>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Precio en Soles (PEN):</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">S/</span>
                  <Input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                    className="pl-8 text-sm font-bold"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Costo en Soles: S/ {editingProduct.totalCostPEN?.toFixed(2) || '0.00'}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditingProduct(null)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSavePrice}
              disabled={savingPrice || newPrice <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              {savingPrice ? 'Guardando...' : 'Guardar Precio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
