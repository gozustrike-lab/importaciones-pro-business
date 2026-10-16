'use client';

import { useEffect, useState } from 'react';
import {
  Printer,
  Download,
  ArrowLeft,
  Smartphone,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { getProductCatalogInfo, CatalogItemInfo } from '@/lib/catalog-helper';

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

const cdnImageMap: Record<string, string> = {
  'ipad-mini-5': 'https://cdn.sanity.io/images/kqneikcb/production/b737d4f68597ff767ffc14b10292eb2498654522-800x800.png',
  'ipad-pro-105': 'https://cdn.sanity.io/images/kqneikcb/production/7011d8372143b4b46d82ffeec39fdadc570bac94-800x800.png',
  'ipad-pro-129': 'https://cdn.sanity.io/images/kqneikcb/production/9097efc98b761c70309a6ab9a4acbd698cb941e1-800x800.png',
  'ipad-9': 'https://cdn.sanity.io/images/kqneikcb/production/63bf9ccb9e99c6e6083505db50021f951372e596-800x800.png',
  'ipad-air-3': 'https://cdn.sanity.io/images/kqneikcb/production/53bf215ec16b39bf7af3766dbb3b2cab62dfe919-800x800.png',
  'macbook-pro-16': 'https://cdn.sanity.io/images/kqneikcb/production/1189f3e9e0778c529d6fb8c59b5227fad2dc161d-800x800.png',
  'macbook-pro-15': 'https://cdn.sanity.io/images/kqneikcb/production/407623aa9ebc4d815fb5ca5a0f88ab09a6fd36a4-800x800.png',
  'macbook-pro-13': 'https://cdn.sanity.io/images/kqneikcb/production/940ca333729ad4dc48ad5006e109506e5614e187-800x800.png',
  'dell-latitude-3330': 'https://cdn.sanity.io/images/kqneikcb/production/d88826aa275949b471b93fffddbe5ee4f956d06c-800x800.png',
  'charger-96w': 'https://cdn.sanity.io/images/kqneikcb/production/b73a6b11beaf76e29f2ed55bdcf934847911e337-800x800.png',
};

export default function CatalogoPrintPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products?archived=false')
      .then((r) => r.json())
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-emerald-400">
          Cargando catálogo oficial iTech Perú...
        </p>
      </div>
    );
  }

  const enriched = products.map((p) => {
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

    const modelKeyMatch = info.referenceImage.match(/\/catalog\/([a-z0-9-]+?)(?:-\d)?\.png/i);
    const modelKey = modelKeyMatch ? modelKeyMatch[1] : '';
    const cdnImg = cdnImageMap[modelKey] || 'https://cdn.sanity.io/images/kqneikcb/production/1189f3e9e0778c529d6fb8c59b5227fad2dc161d-800x800.png';

    return { product: p, info, cdnImg };
  });

  return (
    <div className="bg-slate-100 min-h-screen text-slate-900 font-sans print:bg-white print:p-0">
      {/* FLOATING ACTION BAR (HIDDEN IN PRINT) */}
      <div className="print:hidden sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-emerald-500/30 px-6 py-3.5 flex items-center justify-between text-white shadow-xl">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Dashboard</span>
          </a>
          <div>
            <h1 className="text-sm font-bold flex items-center gap-2">
              <span>Catálogo Ejecutivo iTech Perú 2026</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                {enriched.length} Productos
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Vista optimizada para guardar como PDF (A4) o imprimir sin recortes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/api/catalog/export-whatsapp"
            download="catalogo_whatsapp_business.csv"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV WhatsApp Business</span>
          </a>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Guardar como PDF / Imprimir</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 sm:p-8 print:p-0 print:max-w-none space-y-8 print:space-y-0">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PAGE 1: LUXURY COVER PAGE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="print:break-after-page min-h-[92vh] print:min-h-[98vh] flex flex-col justify-between p-10 sm:p-14 rounded-3xl bg-slate-950 text-white border-2 border-emerald-500/40 relative overflow-hidden shadow-2xl">
          {/* Ambient Lighting */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Cover Header */}
          <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-400 flex items-center justify-center font-black text-slate-950 text-3xl shadow-xl shadow-emerald-500/20">
                iT
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                  iTech Perú
                </h2>
                <p className="text-xs text-emerald-400 font-bold tracking-widest uppercase">
                  Importaciones Directas USA • Mayorista & Retail
                </p>
              </div>
            </div>

            <div className="text-right space-y-1">
              <span className="inline-block px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                Edición Oficial 2026
              </span>
              <p className="text-xs text-slate-400">Stock Real Miami & Lima</p>
            </div>
          </div>

          {/* Cover Body */}
          <div className="relative z-10 my-auto py-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/10 text-emerald-300 text-xs font-semibold tracking-wide border border-white/10">
              <Sparkles className="h-4 w-4 text-amber-400" />
              CATÁLOGO EJECUTIVO & OPORTUNIDADES TIKTOK LIVE
            </div>

            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              TECNOLOGÍA APPLE & <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                EQUIPOS PREMIUM DE ALTO RENDIMIENTO
              </span>
            </h1>

            <p className="text-base text-slate-300 max-w-2xl leading-relaxed">
              Equipos 100% originales seleccionados e inspeccionados en 30 puntos técnicos antes de su embarque desde Miami. Precios de oportunidad exclusiva para compras directas y transmisiones en vivo por TikTok Live.
            </p>

            {/* 4 Pillars Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Garantía Escrita 3 Meses
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  Soporte técnico directo, respaldo posventa y cambio inmediato ante cualquier defecto de fábrica.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Grado A Certificado
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  Chasis impecable, baterías con óptima salud y números de serie verificables en Apple Check Coverage.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-cyan-400" />
                  En Vivo por TikTok Live
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  Mostramos el equipo físico exacto en pantalla antes de tu confirmación de compra y despacho.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-teal-400" />
                  Envíos Asegurados a Todo el Perú
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  Entregas en Lima y envíos a provincia vía Shalom y Olva Courier con código de rastreo oficial.
                </p>
              </div>
            </div>
          </div>

          {/* Cover Footer */}
          <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-xs">
            <div className="space-y-1">
              <p className="text-slate-400">Atención Directa & Separaciones:</p>
              <p className="text-xl font-black text-emerald-400">📲 WhatsApp: +51 924 967 876</p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-slate-400">Tienda Web Oficial:</p>
              <p className="font-bold text-white text-base">🌐 www.itechperu.shop</p>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PAGES 2+: PRODUCT CATALOG ITEMS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-5">
            {enriched.map(({ product, info, cdnImg }, idx) => {
              return (
                <div
                  key={product.id || idx}
                  className="bg-white rounded-2xl border-2 border-slate-200 p-5 flex flex-col justify-between shadow-sm print:shadow-none print:border-slate-300 print:break-inside-avoid print:mb-6"
                  style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                >
                  <div className="space-y-4">
                    {/* Header: Brand & Order badge */}
                    <div className="flex items-center justify-between border-b pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] uppercase tracking-wider">
                          {info.category}
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          {info.brand}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Ord: {product.orderNumber}
                      </span>
                    </div>

                    {/* Image (Centered, High-Res Sanity CDN) */}
                    <div className="w-full h-52 bg-slate-50 rounded-xl p-3 flex items-center justify-center border border-slate-100 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cdnImg}
                        alt={info.commercialTitle}
                        className="max-h-48 max-w-full object-contain"
                        crossOrigin="anonymous"
                      />
                    </div>

                    {/* Title */}
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">
                        {info.commercialTitle}
                      </h3>
                    </div>

                    {/* Technical Specifications */}
                    <div className="space-y-1.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-slate-600 shrink-0">🖥️ Pantalla:</span>
                        <span className="text-slate-800 leading-tight">{info.displaySpecs}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-slate-600 shrink-0">⚙️ Procesador:</span>
                        <span className="text-slate-800 leading-tight">{info.cpuSpecs}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-slate-600 shrink-0">🧠 Memoria:</span>
                        <span className="text-slate-900 font-extrabold">{info.ramSpecs}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="font-bold text-slate-600 shrink-0">💾 Almacenamiento:</span>
                        <span className="text-slate-900 font-extrabold">{info.storageSpecs}</span>
                      </div>
                      <div className="flex items-start gap-1.5 pt-1 border-t border-slate-200">
                        <span className="font-bold text-slate-600 shrink-0">✨ Estado:</span>
                        <span className="text-emerald-700 font-semibold">{info.conditionLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing & WhatsApp Reservation */}
                  <div className="pt-4 border-t mt-4 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <span className="text-xs text-slate-400 line-through block">
                          S/ {info.regularPricePen}
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-emerald-700">
                            S/ {info.salePricePen}
                          </span>
                          <span className="text-xs font-extrabold text-slate-600 uppercase">
                            PEN (Live)
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Garantía 3 Meses
                        </span>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900 text-white rounded-xl text-center space-y-0.5">
                      <p className="text-xs font-extrabold text-emerald-400">
                        📲 WhatsApp Pedidos: +51 924 967 876
                      </p>
                      <p className="text-[10px] text-slate-300 font-mono">
                        Indicar Orden: {product.orderNumber} • www.itechperu.shop
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
