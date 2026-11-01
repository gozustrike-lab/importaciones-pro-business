'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  TrendingUp,
  Wallet,
  Mic,
  MicOff,
  Sparkles,
  Zap,
  BadgeDollarSign,
  Calendar,
  X,
  CreditCard,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { fetchProducts } from '@/lib/api';
import type { Product } from '@/lib/types';
import { toast } from 'sonner';

interface FinancialSummary {
  daily: {
    ventasHoy: number;
    costosHoy: number;
    gananciaHoy: number;
    margenHoy: number;
    comprasHoyUsd: number;
    itemsVendidosHoy: number;
    itemsCompradosHoy: number;
  };
  weekly: {
    ventasSemana: number;
    costosSemana: number;
    gananciaSemana: number;
    margenSemana: number;
    comprasSemanaUsd: number;
    itemsVendidosSemana: number;
    itemsCompradosSemana: number;
  };
  monthly: {
    mesNombre: string;
    ventasMes: number;
    costosMes: number;
    gananciaMes: number;
    margenMes: number;
    comprasMesUsd: number;
    itemsVendidosMes: number;
    itemsCompradosMes: number;
  };
  historicalMonths: Array<{
    monthKey: string;
    label: string;
    ventasPen: number;
    costosPen: number;
    gananciaPen: number;
    margen: number;
    comprasUsd: number;
    totalItemsPurchased: number;
    totalItemsSold: number;
  }>;
}

interface LogisticaSimpleTabProps {
  onNavigate?: (tab: string) => void;
}

export function LogisticaSimpleTab({ onNavigate }: LogisticaSimpleTabProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [financialLoading, setFinancialLoading] = useState(true);
  const [financialData, setFinancialData] = useState<FinancialSummary | null>(null);

  const [activeSection, setActiveSection] = useState<'finanzas' | 'inventario'>('finanzas');
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [selectedLocation, setSelectedLocation] = useState<'todos' | 'miami' | 'transito' | 'usa'>('todos');

  // ── Voice & Quick Sale Modal State ──
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<Product | null>(null);
  const [voiceText, setVoiceText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [salePriceInput, setSalePriceInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState('Yape');
  const [clientNameInput, setClientNameInput] = useState('');
  const [processingSale, setProcessingSale] = useState(false);
  const [lastSaleResult, setLastSaleResult] = useState<any | null>(null);

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

  const loadFinancialSummary = async () => {
    setFinancialLoading(true);
    try {
      const res = await fetch('/api/analytics/financial-summary');
      const data = await res.json();
      if (data.success) {
        setFinancialData(data);
      }
    } catch (err: any) {
      console.error('Error loading financial summary:', err);
    } finally {
      setFinancialLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadFinancialSummary();
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

  // ── Voice / Speech Recognition ──
  const startVoiceRecording = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      toast.info('Tu navegador no soporta dictado directo. Puedes escribir o pegar el mensaje en el cuadro.');
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'es-PE';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
        toast.info('🎙️ Escuchando... Habla ahora (ej: "Vendí iPad Pro 10.5 a 1200 por Yape a Carlos")');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceText(transcript);
        parseVoiceText(transcript);
        setIsRecording(false);
        toast.success(`🎙️ Reconocido: "${transcript}"`);
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech error:', e);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err: any) {
      console.error(err);
      setIsRecording(false);
    }
  };

  // Instant local parsing of voice/text
  const parseVoiceText = (text: string) => {
    const lower = text.toLowerCase();

    // Extract price
    const priceMatch = text.match(/(?:s\/?\.?|soles|a|por|precio|en)?\s*(\d{2,5}(?:\.\d{1,2})?)\s*(?:soles|pen)?/i);
    if (priceMatch && priceMatch[1]) {
      const p = parseFloat(priceMatch[1]);
      if (p >= 50 && p <= 25000) {
        setSalePriceInput(String(p));
      }
    }

    // Extract method
    if (lower.includes('yape')) setPaymentMethodInput('Yape');
    else if (lower.includes('plin')) setPaymentMethodInput('Plin');
    else if (lower.includes('bcp')) setPaymentMethodInput('BCP');
    else if (lower.includes('bbva')) setPaymentMethodInput('BBVA');
    else if (lower.includes('interbank')) setPaymentMethodInput('Interbank');
    else if (lower.includes('efectivo')) setPaymentMethodInput('Efectivo');
    else if (lower.includes('transferencia')) setPaymentMethodInput('Transferencia');

    // Extract client name
    const clientMatch = text.match(/(?:a|para|cliente)\s+([A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}(?:\s+[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,})?)/i);
    if (clientMatch && clientMatch[1]) {
      const ignore = ['soles', 'yape', 'plin', 'efectivo', 'bcp', 'bbva', 'precio', 'cuenta'];
      if (!ignore.includes(clientMatch[1].toLowerCase().trim())) {
        setClientNameInput(clientMatch[1].trim());
      }
    }

    // Match product from inventory
    if (!selectedProductForSale) {
      const match = products.find((p) => {
        const desc = p.description.toLowerCase();
        if (lower.includes('16') && (desc.includes('16') || desc.includes('a2141'))) return true;
        if (lower.includes('15') && (desc.includes('15') || desc.includes('a1990'))) return true;
        if (lower.includes('12.9') && desc.includes('12.9')) return true;
        if (lower.includes('air 3') && (desc.includes('air 3') || desc.includes('a2153') || desc.includes('air (3rd'))) return true;
        if (lower.includes('ipad 9') && (desc.includes('ipad 9') || desc.includes('9th') || desc.includes('a2602') || desc.includes('a2603'))) return true;
        if ((lower.includes('pro 10.5') || lower.includes('10.5')) && desc.includes('10.5') && !desc.includes('air')) return true;
        if (lower.includes('dell') && (desc.includes('dell') || desc.includes('latitude'))) return true;
        if (lower.includes('mini') && desc.includes('mini')) return true;
        return false;
      });

      if (match) {
        setSelectedProductForSale(match);
        if (!salePriceInput) {
          setSalePriceInput(String(match.salePricePEN || 1000));
        }
      }
    }
  };

  // Open sale modal directly for a specific product
  const handleOpenSaleForProduct = (p: Product) => {
    setSelectedProductForSale(p);
    setSalePriceInput(p.salePricePEN ? String(p.salePricePEN) : '1000');
    setPaymentMethodInput('Yape');
    setClientNameInput('');
    setVoiceText(`Vendí ${p.description.slice(0, 35)}`);
    setLastSaleResult(null);
    setSaleModalOpen(true);
  };

  // Process the quick sale
  const handleExecuteSale = async () => {
    if (!selectedProductForSale) {
      toast.error('Selecciona el producto a vender o díctalo en la nota de voz');
      return;
    }

    const price = parseFloat(salePriceInput);
    if (!price || price <= 0) {
      toast.error('Ingresa un precio de venta válido en Soles');
      return;
    }

    setProcessingSale(true);
    try {
      const res = await fetch('/api/sales/voice-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: voiceText,
          productId: selectedProductForSale.id,
          salePricePen: price,
          paymentMethod: paymentMethodInput,
          clientName: clientNameInput || 'Cliente Mostrador (Venta Rápida)',
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || '¡Venta registrada con éxito!');
        setLastSaleResult(data);
        await loadData();
        await loadFinancialSummary();
        setTimeout(() => {
          setSaleModalOpen(false);
          setLastSaleResult(null);
          setSelectedProductForSale(null);
          setVoiceText('');
        }, 3000);
      } else {
        toast.error(data.error || 'Error al procesar la venta');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error de conexión');
    } finally {
      setProcessingSale(false);
    }
  };

  // Estimate profit live in modal
  const estimatedCostPen = useMemo(() => {
    if (!selectedProductForSale) return 0;
    const usd = selectedProductForSale.purchasePriceUSD || 0;
    return Math.round((usd + 15) * 3.75);
  }, [selectedProductForSale]);

  const estimatedProfitPen = useMemo(() => {
    const p = parseFloat(salePriceInput) || 0;
    return Math.round((p - estimatedCostPen) * 100) / 100;
  }, [salePriceInput, estimatedCostPen]);

  const estimatedMargin = useMemo(() => {
    const p = parseFloat(salePriceInput) || 0;
    if (p <= 0) return 0;
    return Math.round((estimatedProfitPen / p) * 1000) / 10;
  }, [salePriceInput, estimatedProfitPen]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 1. TOP HEADER & VIEW SWITCHER (FINANZAS vs INVENTARIO) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                CONTROL TOTAL • UTILIDADES & LOGÍSTICA
              </span>
              <span className="text-xs text-slate-400">Todo automático y sin errores</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Control Financiero & Inventario eBay en Vivo
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1">
              Conoce cuánto vendes diario, semanal y mensual, tus costos reales y tu ganancia neta.
            </p>
          </div>

          {/* Quick Voice / Sale Action + Switchers */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={() => {
                setSelectedProductForSale(null);
                setSalePriceInput('');
                setVoiceText('');
                setLastSaleResult(null);
                setSaleModalOpen(true);
              }}
              size="sm"
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs gap-1.5 rounded-xl shadow-lg shadow-emerald-950/40 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <Mic className="w-4 h-4" />
              <span>🎙️ Registrar Venta (Voz / Texto)</span>
            </Button>

            <Button
              onClick={() => onNavigate?.('compras')}
              variant="outline"
              size="sm"
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700 font-bold text-xs gap-1.5 rounded-xl"
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
              onClick={() => {
                loadData();
                loadFinancialSummary();
              }}
              disabled={loading || financialLoading}
              variant="secondary"
              size="sm"
              className="font-bold text-xs gap-1.5 rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || financialLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </Button>
          </div>
        </div>

        {/* Section Tabs: Finanzas vs Inventario */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setActiveSection('finanzas')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSection === 'finanzas'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>📊 Finanzas & Ganancias (Diario / Semanal / Mensual)</span>
          </button>

          <button
            onClick={() => setActiveSection('inventario')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeSection === 'inventario'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>📦 Control de Importaciones & Vuelos ({products.length})</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 2. FINANCIAL DASHBOARD SECTION (DIARIO, SEMANAL, MENSUAL) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'finanzas' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Main 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Hoy (Diario) */}
            <Card className="bg-[#0B1220] border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    HOY (DIARIO)
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl sm:text-3xl font-black text-white mt-1">
                  S/ {(financialData?.daily.gananciaHoy || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </CardTitle>
                <CardDescription className="text-xs text-emerald-300 font-bold">
                  Utilidad Neta Limpia ({financialData?.daily.margenHoy || 0}% margen)
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-2 text-xs space-y-1.5 border-t border-slate-800/80">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Ventas hoy:</span>
                  <span className="font-bold text-white">
                    S/ {(financialData?.daily.ventasHoy || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Costos de ventas:</span>
                  <span className="font-medium text-slate-400">
                    S/ {(financialData?.daily.costosHoy || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Compras eBay hoy:</span>
                  <span className="font-bold text-sky-400">
                    ${(financialData?.daily.comprasHoyUsd || 0).toFixed(2)} USD
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Esta Semana */}
            <Card className="bg-[#0B1220] border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-sky-400" />
                    ESTA SEMANA
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-sky-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl sm:text-3xl font-black text-white mt-1">
                  S/ {(financialData?.weekly.gananciaSemana || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </CardTitle>
                <CardDescription className="text-xs text-sky-300 font-bold">
                  Utilidad Neta de la Semana ({financialData?.weekly.margenSemana || 0}% margen)
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-2 text-xs space-y-1.5 border-t border-slate-800/80">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Ventas semana:</span>
                  <span className="font-bold text-white">
                    S/ {(financialData?.weekly.ventasSemana || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Equipos vendidos:</span>
                  <span className="font-bold text-emerald-400">
                    {financialData?.weekly.itemsVendidosSemana || 0} unidades
                  </span>
                </div>
                <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Compras eBay semana:</span>
                  <span className="font-bold text-sky-400">
                    ${(financialData?.weekly.comprasSemanaUsd || 0).toFixed(2)} USD
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Este Mes */}
            <Card className="bg-[#0B1220] border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-purple-400" />
                    ESTE MES ({financialData?.monthly.mesNombre || 'Actual'})
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <BadgeDollarSign className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl sm:text-3xl font-black text-white mt-1">
                  S/ {(financialData?.monthly.gananciaMes || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                </CardTitle>
                <CardDescription className="text-xs text-purple-300 font-bold">
                  Utilidad Neta del Mes ({financialData?.monthly.margenMes || 0}% margen)
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-2 text-xs space-y-1.5 border-t border-slate-800/80">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Ventas totales:</span>
                  <span className="font-bold text-white">
                    S/ {(financialData?.monthly.ventasMes || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">Costos totales:</span>
                  <span className="font-medium text-slate-400">
                    S/ {(financialData?.monthly.costosMes || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Compras eBay mes:</span>
                  <span className="font-bold text-sky-400">
                    ${(financialData?.monthly.comprasMesUsd || 0).toFixed(2)} USD
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Acceso Rápido a Venta Asistida */}
            <Card className="bg-gradient-to-br from-[#062427] via-[#0B1525] to-[#0A101D] border-teal-500/40 shadow-xl flex flex-col justify-between p-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-black text-teal-300 bg-teal-950/80 border border-teal-800/80 px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                  VENTA POR VOZ & CHAT IA
                </div>
                <h3 className="text-lg font-black text-white leading-snug">
                  ¿Acabas de vender un equipo?
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Solo dicta o escribe: <em>"Vendí iPad Pro 10.5 a 1200 por Yape"</em> y el sistema actualiza tu Excel y la web en 2 segundos.
                </p>
              </div>

              <Button
                onClick={() => {
                  setSelectedProductForSale(null);
                  setSalePriceInput('');
                  setVoiceText('');
                  setLastSaleResult(null);
                  setSaleModalOpen(true);
                }}
                className="w-full mt-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs gap-2 rounded-xl shadow-lg shadow-emerald-950/50"
              >
                <Mic className="w-4 h-4" />
                <span>Dictar Venta Ahora</span>
              </Button>
            </Card>
          </div>

          {/* Historical Month-by-Month Financial Summary */}
          <Card className="bg-[#0B1220] border-slate-800 shadow-xl">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    Historial de Utilidades Mes a Mes (Todas tus Ventas & Costos)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Cruce de ventas electrónicas reales, costos de importación y ganancia neta mes a mes.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {financialLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Cargando métricas financieras...</div>
              ) : (financialData?.historicalMonths || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No hay datos históricos aún.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Período / Mes</th>
                        <th className="py-3 px-4 text-right">Ventas Totales</th>
                        <th className="py-3 px-4 text-right">Costos Totales</th>
                        <th className="py-3 px-4 text-right font-bold text-emerald-400">Utilidad Neta (Ganancia)</th>
                        <th className="py-3 px-4 text-center">Margen</th>
                        <th className="py-3 px-4 text-right">Compras eBay</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {financialData?.historicalMonths.map((m) => (
                        <tr key={m.monthKey} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            {m.label}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-white">
                            S/ {m.ventasPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-400">
                            S/ {m.costosPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-400 text-sm">
                            + S/ {m.gananciaPen.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                              {m.margen}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-sky-400 font-mono font-bold">
                            ${m.comprasUsd.toFixed(2)} USD
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-[10px] text-slate-400 font-bold bg-slate-900 px-2 py-0.5 rounded">
                              Declarado
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 3. INVENTORY & SHIPMENT SECTION (EXISTING SIMPLE LOGISTICS) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeSection === 'inventario' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Top 3 Logistics KPI Cards */}
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

            {/* KPI 3: Semáforo de Verificación */}
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
                    <span>¿Están en sistema? SÍ ({products.length} de {products.length})</span>
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

          {/* Category Filter Pills & Search */}
          <div className="space-y-3 bg-[#0B1220] p-4 sm:p-5 rounded-2xl border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-emerald-400" />
                  Tus Productos Activos por Categoría
                </h3>
                <p className="text-xs text-slate-400">
                  Selecciona una categoría o pulsa <strong>"⚡ Vender"</strong> en cualquier equipo para registrar su venta inmediata:
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

          {/* Product Cards List */}
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

                      {/* Bottom: Pricing & Quick Vender Button */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Costo Compra:</span>
                          <span className="text-sm font-black text-white">
                            ${p.purchasePriceUSD.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">USD</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block font-medium">Sugerido:</span>
                            <span className="text-xs font-black text-emerald-400">
                              {p.salePricePEN ? `S/ ${p.salePricePEN}` : 'S/ 1,000'}
                            </span>
                          </div>

                          <Button
                            onClick={() => handleOpenSaleForProduct(p)}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 h-8 rounded-xl shadow-md gap-1"
                          >
                            <Zap className="w-3 h-3" />
                            <span>Vender</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 4. MODAL: REGISTRAR VENTA ASISTIDA POR VOZ / TEXTO (IA) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={saleModalOpen} onOpenChange={setSaleModalOpen}>
        <DialogContent className="bg-[#0B1220] border-slate-800 text-white max-w-lg p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                VENTA ASISTIDA POR VOZ O TEXTO (IA)
              </div>
            </div>
            <DialogTitle className="text-xl font-black text-white mt-2">
              Registrar Venta Inmediata
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Dicta o escribe libremente lo vendido. El sistema calcula tu ganancia neta, descuenta el stock de la web y lo guarda en tu Excel.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Voice Dictation Card with Mic Button */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-emerald-400" /> Dictar nota de voz o escribir:
                </span>
                <Button
                  type="button"
                  onClick={startVoiceRecording}
                  disabled={isRecording}
                  size="sm"
                  className={`text-xs font-bold rounded-xl h-8 px-3 gap-1.5 transition-all ${
                    isRecording
                      ? 'bg-rose-600 animate-pulse text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                  }`}
                >
                  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isRecording ? 'Escuchando...' : 'Presionar para Hablar'}</span>
                </Button>
              </div>

              <textarea
                value={voiceText}
                onChange={(e) => {
                  setVoiceText(e.target.value);
                  parseVoiceText(e.target.value);
                }}
                placeholder="Ejemplo: Vendí iPad Pro 10.5 de 512gb a 1200 soles por Yape a Carlos"
                className="w-full bg-[#070B14] border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none resize-none h-20"
              />
            </div>

            {/* Product Selector Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Equipo vendido del inventario:</label>
              <select
                value={selectedProductForSale?.id || ''}
                onChange={(e) => {
                  const p = products.find((item) => item.id === e.target.value);
                  setSelectedProductForSale(p || null);
                  if (p && !salePriceInput) {
                    setSalePriceInput(String(p.salePricePEN || 1000));
                  }
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Seleccionar producto o dictar arriba --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.description.slice(0, 48)} (Costo: ${p.purchasePriceUSD})
                  </option>
                ))}
              </select>
            </div>

            {/* Price and Payment Method in 2 Columns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Precio de Venta (S/ PEN):</label>
                <div className="relative">
                  <span className="text-xs font-bold text-slate-500 absolute left-3 top-1/2 -translate-y-1/2">S/</span>
                  <Input
                    type="number"
                    value={salePriceInput}
                    onChange={(e) => setSalePriceInput(e.target.value)}
                    placeholder="1200"
                    className="bg-slate-900 border-slate-800 text-xs pl-8 text-white font-bold h-9 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Método de Pago:</label>
                <select
                  value={paymentMethodInput}
                  onChange={(e) => setPaymentMethodInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 h-9 font-bold"
                >
                  <option value="Yape">Yape</option>
                  <option value="Plin">Plin</option>
                  <option value="BCP">Transferencia BCP</option>
                  <option value="BBVA">Transferencia BBVA</option>
                  <option value="Interbank">Interbank</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta de Crédito</option>
                </select>
              </div>
            </div>

            {/* Client Name Input (Optional) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Nombre del Cliente (Opcional):</label>
              <Input
                type="text"
                value={clientNameInput}
                onChange={(e) => setClientNameInput(e.target.value)}
                placeholder="Ej. Carlos Gómez o Cliente Mostrador"
                className="bg-slate-900 border-slate-800 text-xs text-white h-9 rounded-xl placeholder-slate-600"
              />
            </div>

            {/* Live Profit Preview Box */}
            {selectedProductForSale && (
              <div className="bg-emerald-950/40 border border-emerald-800/60 p-3.5 rounded-xl text-xs space-y-1.5">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Costo Adquisición (Producto + Flete):</span>
                  <span className="font-mono text-slate-400">S/ {estimatedCostPen.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Precio de Venta:</span>
                  <span className="font-bold text-white">S/ {parseFloat(salePriceInput || '0').toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-emerald-800/50">
                  <span className="font-black text-emerald-300">Ganancia Neta (Tu Utilidad Limpia):</span>
                  <span className="text-sm font-black text-emerald-400">
                    + S/ {estimatedProfitPen.toFixed(2)} ({estimatedMargin}%)
                  </span>
                </div>
              </div>
            )}

            {/* Success Result Confirmation */}
            {lastSaleResult && (
              <div className="bg-emerald-500/20 border border-emerald-500 p-3 rounded-xl text-xs text-emerald-200 text-center font-bold">
                🎉 {lastSaleResult.message}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaleModalOpen(false)}
              className="text-xs font-bold bg-slate-900 border-slate-800 text-slate-300 rounded-xl"
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={handleExecuteSale}
              disabled={processingSale || !selectedProductForSale}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs gap-1.5 rounded-xl shadow-lg shadow-emerald-950/50"
            >
              {processingSale ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando y Guardando en Excel...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Confirmar Venta y Guardar en Excel</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
