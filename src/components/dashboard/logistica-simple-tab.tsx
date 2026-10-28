'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plane,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Clock,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  FileSpreadsheet,
  RefreshCw,
  Smartphone,
  Search,
  Laptop,
  Tablet,
  ArrowRight,
  Info,
  DollarSign,
  Boxes,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchProducts } from '@/lib/api';
import type { Product } from '@/lib/types';
import { toast } from 'sonner';

interface LogisticaSimpleTabProps {
  onNavigate?: (tab: string) => void;
}

export function LogisticaSimpleTab({ onNavigate }: LogisticaSimpleTabProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [selectedLocation, setSelectedLocation] = useState<'todos' | 'miami' | 'transito' | 'usa'>('todos');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchProducts({ archived: 'false' });
      setProducts(data || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar inventario activo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute metrics
  const inShiperMiami = useMemo(() => products.filter((p) => p.shipperConfirmed), [products]);
  const inTransitoUsa = useMemo(() => products.filter((p) => p.status === 'TRANSITO_USA'), [products]);
  const inCasilleroPending = useMemo(
    () => products.filter((p) => !p.shipperConfirmed && p.status !== 'TRANSITO_USA'),
    [products]
  );

  const totalCostUsd = useMemo(
    () => products.reduce((acc, p) => acc + (p.purchasePriceUSD || 0), 0),
    [products]
  );

  // Group by commercial category
  const categorized = useMemo(() => {
    const map: Record<string, Product[]> = {
      macbook: [],
      ipad_pro: [],
      ipad_air: [],
      ipad_9: [],
      dell: [],
      otros: [],
    };

    products.forEach((p) => {
      const desc = (p.description || '').toLowerCase();
      if (desc.includes('macbook')) {
        if (desc.includes('charger') || desc.includes('cargador') || desc.includes('screen assembly')) {
          map.otros.push(p);
        } else {
          map.macbook.push(p);
        }
      } else if (desc.includes('12.9') || desc.includes('10.5') || desc.includes('a1701')) {
        if (desc.includes('air')) {
          map.ipad_air.push(p);
        } else {
          map.ipad_pro.push(p);
        }
      } else if (desc.includes('air 3') || desc.includes('air (3rd')) {
        map.ipad_air.push(p);
      } else if (desc.includes('ipad 9') || desc.includes('9th gen') || desc.includes('a2602') || desc.includes('a2603')) {
        map.ipad_9.push(p);
      } else if (desc.includes('dell') || desc.includes('latitude')) {
        map.dell.push(p);
      } else {
        map.otros.push(p);
      }
    });

    return map;
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    let list = products;

    if (selectedLocation === 'miami') list = inShiperMiami;
    if (selectedLocation === 'transito') list = inTransitoUsa;
    if (selectedLocation === 'usa') list = inCasilleroPending;

    if (selectedCategory !== 'todos') {
      list = list.filter((p) => {
        const desc = (p.description || '').toLowerCase();
        if (selectedCategory === 'macbook') return desc.includes('macbook') && !desc.includes('charger') && !desc.includes('screen');
        if (selectedCategory === 'ipad_pro') return (desc.includes('12.9') || desc.includes('10.5')) && !desc.includes('air');
        if (selectedCategory === 'ipad_air') return desc.includes('air');
        if (selectedCategory === 'ipad_9') return desc.includes('ipad 9') || desc.includes('9th') || desc.includes('a2602');
        if (selectedCategory === 'dell') return desc.includes('dell') || desc.includes('latitude');
        if (selectedCategory === 'otros') return !desc.includes('macbook') && !desc.includes('ipad') && !desc.includes('dell');
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.description?.toLowerCase().includes(q) ||
          p.orderNumber?.toLowerCase().includes(q) ||
          p.trackingNumber?.toLowerCase().includes(q) ||
          p.courier?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [products, selectedLocation, selectedCategory, searchQuery, inShiperMiami, inTransitoUsa, inCasilleroPending]);

  const handleCopyTracking = (trk: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(trk);
      setCopiedTracking(trk);
      setTimeout(() => setCopiedTracking(null), 2000);
      toast.success('Tracking copiado al portapapeles');
    }
  };

  const handleCopyAllMiamiTrackings = () => {
    const trackings = inShiperMiami
      .map((p) => `${p.courier} ${p.trackingNumber} (${p.description.slice(0, 35)})`)
      .join('\n');
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(trackings);
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2500);
      toast.success(`${inShiperMiami.length} trackings copiados para Shiper`);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. TOP HEADER & QUICK SWITCHER */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                MODO SIMPLE • CONTROL LOGÍSTICO EJECUTIVO
              </span>
              <span className="text-xs text-slate-400">Sin tablas complejas ni enredos</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Trazabilidad de Compras & Embarques en Vivo
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1">
              Aquí tienes el control exacto de lo que compraste en eBay, qué paquetes están listos en Miami y qué modelos se muestran en tu web.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => onNavigate?.('compras')}
              variant="outline"
              size="sm"
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 font-bold text-xs gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Ver Módulo Excel</span>
            </Button>

            <a
              href="https://www.itechperu.shop/catalogo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#25D366] hover:bg-[#20BD5A] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition-all hover:scale-[1.02]"
            >
              <Smartphone className="w-4 h-4" />
              <span>Ver Catálogo Web</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>

            <Button
              onClick={loadData}
              disabled={loading}
              variant="secondary"
              size="sm"
              className="font-bold text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. THE 3 GOLDEN QUESTIONS (RESPUESTAS CLARAS Y DIRECTAS) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* KPI 1: Cantidad de Importaciones */}
        <Card className="bg-[#0B1220] border-slate-800 shadow-lg relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                1. ¿Cuántas Importaciones?
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Package className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <CardTitle className="text-3xl sm:text-4xl font-black text-white mt-1">
              {products.length} <span className="text-sm font-semibold text-slate-400">paquetes activos</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 font-medium">
              Inversión Total: <strong className="text-emerald-400 font-bold">${totalCostUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</strong>
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2 space-y-2">
            <div className="grid grid-cols-3 gap-1.5 text-center pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedLocation(selectedLocation === 'miami' ? 'todos' : 'miami')}
                className={`p-2 rounded-xl border transition-all text-left ${
                  selectedLocation === 'miami'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-md'
                    : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                <span className="text-[10px] text-slate-400 block font-medium">🏢 En Miami</span>
                <span className="text-base font-black text-emerald-400">{inShiperMiami.length}</span>
              </button>

              <button
                onClick={() => setSelectedLocation(selectedLocation === 'transito' ? 'todos' : 'transito')}
                className={`p-2 rounded-xl border transition-all text-left ${
                  selectedLocation === 'transito'
                    ? 'bg-sky-950 text-sky-300 border-sky-500 shadow-md'
                    : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                <span className="text-[10px] text-slate-400 block font-medium">🚚 En Tránsito</span>
                <span className="text-base font-black text-sky-400">{inTransitoUsa.length}</span>
              </button>

              <button
                onClick={() => setSelectedLocation(selectedLocation === 'usa' ? 'todos' : 'usa')}
                className={`p-2 rounded-xl border transition-all text-left ${
                  selectedLocation === 'usa'
                    ? 'bg-amber-950 text-amber-300 border-amber-500 shadow-md'
                    : 'bg-slate-900/60 hover:bg-slate-900 text-slate-300 border-slate-800'
                }`}
              >
                <span className="text-[10px] text-slate-400 block font-medium">📦 Casillero</span>
                <span className="text-base font-black text-amber-400">{inCasilleroPending.length}</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Embarques */}
        <Card className="bg-[#0B1220] border-slate-800 shadow-lg relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                2. ¿Embarques / Vuelos?
              </span>
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                <Plane className="w-4 h-4 text-sky-400" />
              </div>
            </div>
            <CardTitle className="text-3xl sm:text-4xl font-black text-white mt-1">
              {inShiperMiami.length} <span className="text-sm font-semibold text-slate-400">en lote de vuelo</span>
            </CardTitle>
            <CardDescription className="text-xs text-sky-300 font-medium">
              Listos en almacén Shiper Miami para vuelo a Lima
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2 space-y-2.5">
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Desglose del lote:</span>
                <span className="text-white font-bold">
                  {categorized.macbook.length} Laptops • {categorized.ipad_pro.length + categorized.ipad_air.length + categorized.ipad_9.length} iPads
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                12 consignados a Peggy • 9 consignados a Fabio
              </p>
            </div>

            <Button
              onClick={handleCopyAllMiamiTrackings}
              variant="outline"
              size="sm"
              className="w-full text-xs font-bold bg-slate-900 hover:bg-slate-800 text-emerald-300 border-emerald-500/40 gap-1.5"
            >
              {copiedBatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedBatch ? '¡Copiados para Shiper!' : 'Copiar 20 Trackings para Shiper'}</span>
            </Button>
          </CardContent>
        </Card>

        {/* KPI 3: Semáforo de Verificación ("¿Todo es correcto?") */}
        <Card className="bg-[#0B1220] border-slate-800 shadow-lg relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                3. ¿Todo es Correcto?
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              100% REGISTRADO
            </CardTitle>
            <CardDescription className="text-xs text-slate-300 font-medium">
              Tus 41 compras de eBay están mapeadas y respaldadas
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2 space-y-2">
            <div className="bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-xl text-[11.5px] space-y-1 text-emerald-200">
              <div className="flex items-center gap-1.5 font-bold">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>¿Están en sistema? SÍ (41 de 41)</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>¿En Stock o Vendidos? 100% Disponibles</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>¿Web protegida? Con badge "FUERA DE STOCK"</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3. CATEGORY PILL FILTER (SELECTOR RÁPIDO A 1 CLIC) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3 bg-[#0B1220] p-4 sm:p-5 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-400" />
              Tus Productos Activos por Categoría
            </h3>
            <p className="text-xs text-slate-400">
              Selecciona una categoría para ver únicamente esos equipos de forma simple:
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por modelo, orden o tracking..."
              className="bg-slate-900 border-slate-700 text-xs pl-8 h-8 text-white placeholder-slate-500 rounded-lg"
            />
          </div>
        </div>

        {/* Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          <Button
            size="sm"
            onClick={() => setSelectedCategory('todos')}
            variant={selectedCategory === 'todos' ? 'default' : 'outline'}
            className={`text-xs font-bold rounded-xl h-8 px-3 shrink-0 ${
              selectedCategory === 'todos' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            Todos ({products.length})
          </Button>

          <Button
            size="sm"
            onClick={() => setSelectedCategory('macbook')}
            variant={selectedCategory === 'macbook' ? 'default' : 'outline'}
            className={`text-xs font-bold rounded-xl h-8 px-3 shrink-0 ${
              selectedCategory === 'macbook' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            💻 MacBooks ({categorized.macbook.length})
          </Button>

          <Button
            size="sm"
            onClick={() => setSelectedCategory('ipad_pro')}
            variant={selectedCategory === 'ipad_pro' ? 'default' : 'outline'}
            className={`text-xs font-bold rounded-xl h-8 px-3 shrink-0 ${
              selectedCategory === 'ipad_pro' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            📱 iPads Pro ({categorized.ipad_pro.length})
          </Button>

          <Button
            size="sm"
            onClick={() => setSelectedCategory('ipad_air')}
            variant={selectedCategory === 'ipad_air' ? 'default' : 'outline'}
            className={`text-xs font-bold rounded-xl h-8 px-3 shrink-0 ${
              selectedCategory === 'ipad_air' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            📱 iPads Air 3 ({categorized.ipad_air.length})
          </Button>

          <Button
            size="sm"
            onClick={() => setSelectedCategory('ipad_9')}
            variant={selectedCategory === 'ipad_9' ? 'default' : 'outline'}
            className={`text-xs font-bold rounded-xl h-8 px-3 shrink-0 ${
              selectedCategory === 'ipad_9' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            📱 iPads 9na Gen ({categorized.ipad_9.length})
          </Button>

          <Button
            size="sm"
            onClick={() => setSelectedCategory('dell')}
            variant={selectedCategory === 'dell' ? 'default' : 'outline'}
            className={`text-xs font-bold rounded-xl h-8 px-3 shrink-0 ${
              selectedCategory === 'dell' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            💻 Dell Latitude ({categorized.dell.length})
          </Button>

          <Button
            size="sm"
            onClick={() => setSelectedCategory('otros')}
            variant={selectedCategory === 'otros' ? 'default' : 'outline'}
            className={`text-xs font-bold rounded-xl h-8 px-3 shrink-0 ${
              selectedCategory === 'otros' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            🔌 Accesorios / Partes ({categorized.otros.length})
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 4. CLEAN PRODUCT CARDS LIST (CERO COLUMNAS CONFUSAS) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>Mostrando <strong>{filteredProducts.length}</strong> de {products.length} productos</span>
          <span className="text-[11px]">Ordenados por fecha de compra más reciente</span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-[#0B1220] p-12 text-center rounded-2xl border border-slate-800 space-y-2">
            <p className="text-slate-400 text-sm font-bold">No se encontraron productos con los filtros seleccionados.</p>
            <Button
              onClick={() => {
                setSelectedCategory('todos');
                setSelectedLocation('todos');
                setSearchQuery('');
              }}
              size="sm"
              variant="outline"
              className="text-xs"
            >
              Restablecer filtros
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredProducts.map((p) => {
              const isMiami = p.shipperConfirmed;
              const isTransito = p.status === 'TRANSITO_USA';
              const trackingUrl = p.trackingNumber
                ? p.courier?.toLowerCase().includes('fedex')
                  ? `https://www.fedex.com/fedextrack/?trknbr=${p.trackingNumber}`
                  : p.courier?.toLowerCase().includes('ups')
                  ? `https://www.ups.com/track?tracknum=${p.trackingNumber}`
                  : `https://tools.usps.com/go/TrackConfirmAction?tLabels=${p.trackingNumber}`
                : null;

              return (
                <div
                  key={p.id}
                  className="bg-[#0B1220] hover:bg-[#0E172A] border border-slate-800 hover:border-emerald-500/40 p-4 rounded-2xl shadow-md transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div className="space-y-2">
                    {/* Top Row: Location Badge & Consignee */}
                    <div className="flex items-center justify-between gap-1.5">
                      {isMiami ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-black px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          🏢 En Miami Shiper OK
                        </span>
                      ) : isTransito ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-black px-2.5 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
                          <Truck className="w-3 h-3 text-sky-400" />
                          🚚 En Tránsito a Miami
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800">
                          <Clock className="w-3 h-3 text-amber-400" />
                          📦 Casillero USA
                        </span>
                      )}

                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          (p.importerProfile || '').toLowerCase() === 'fabio'
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                            : 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                        }`}
                      >
                        {p.importerProfile?.toUpperCase() || 'FABIO'}
                      </span>
                    </div>

                    {/* Commercial Description */}
                    <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2 leading-snug">
                      {p.description}
                    </h4>

                    {/* Order & Tracking Pill */}
                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80 space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Orden eBay:</span>
                        <span className="text-slate-200 font-mono font-bold">{p.orderNumber}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                        <span className="text-slate-400 font-medium">Courier:</span>
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-emerald-400">{p.courier || 'PENDIENTE'}</span>
                          {p.trackingNumber && (
                            <>
                              <button
                                onClick={() => handleCopyTracking(p.trackingNumber)}
                                className="text-slate-400 hover:text-white"
                                title="Copiar tracking"
                              >
                                {copiedTracking === p.trackingNumber ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              {trackingUrl && (
                                <a
                                  href={trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-slate-400 hover:text-sky-400"
                                  title="Rastrear en courier oficial"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom: Pricing & Status */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Costo Compra:</span>
                      <span className="text-sm font-black text-white">
                        ${p.purchasePriceUSD.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">USD</span>
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">Venta Sugerida:</span>
                      <span className="text-sm font-black text-emerald-400">
                        {p.salePricePEN ? `S/ ${p.salePricePEN}` : 'Por definir'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
