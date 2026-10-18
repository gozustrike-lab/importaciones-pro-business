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
  Gift,
  ExternalLink,
  MessageCircle,
  Monitor,
  Cpu,
  Layers,
  HardDrive,
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

interface GroupedCatalogItem extends CatalogItemInfo {
  cdnImg: string;
  stockCount: number;
  orderNumbers: string[];
  productSample: ProductItem;
}

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

  // Enrich raw products
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
    const cdnImg =
      cdnImageMap[modelKey] ||
      'https://cdn.sanity.io/images/kqneikcb/production/1189f3e9e0778c529d6fb8c59b5227fad2dc161d-800x800.png';

    return { product: p, info, cdnImg };
  });

  // Deduplicate and group by commercial title
  const groupsMap = new Map<string, GroupedCatalogItem>();
  for (const item of enriched) {
    const key = item.info.commercialTitle;
    const existing = groupsMap.get(key);
    if (!existing) {
      groupsMap.set(key, {
        ...item.info,
        cdnImg: item.cdnImg,
        stockCount: 1,
        orderNumbers: [item.product.orderNumber],
        productSample: item.product,
      });
    } else {
      existing.stockCount += 1;
      existing.orderNumbers.push(item.product.orderNumber);
    }
  }

  const groupedList = Array.from(groupsMap.values());
  const totalStockUnits = groupedList.reduce((acc, curr) => acc + curr.stockCount, 0);

  const laptops = groupedList.filter((g) => g.category === 'Laptops & MacBooks');
  const tablets = groupedList.filter((g) => g.category === 'iPads & Tablets');
  const accessories = groupedList.filter((g) => g.category === 'Accesorios');

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
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                {groupedList.length} Modelos • {totalStockUnits} Unidades de Stock Real
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Vista consolidada sin duplicados para guardar como PDF (A4) o imprimir
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
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>Guardar como PDF / Imprimir</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto p-4 sm:p-8 print:p-0 print:max-w-none space-y-8 print:space-y-6">
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
              Equipos 100% originales seleccionados e inspeccionados en 30 puntos técnicos antes de su despacho. Precios de oportunidad exclusiva para compras directas y transmisiones en vivo por TikTok Live.
            </p>

            {/* Gift Packages Highlight */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-3 rounded-2xl">
                <Gift className="w-6 h-6 text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-200">
                  🎁 <strong>Laptops & MacBooks:</strong> Incluyen funda portalaptop nueva acolchada de regalo.
                </span>
              </div>
              <div className="flex items-center gap-3 bg-white/10 border border-white/15 px-4 py-3 rounded-2xl">
                <Gift className="w-6 h-6 text-teal-400 shrink-0" />
                <span className="text-xs text-slate-200">
                  🎁 <strong>iPads & Tablets:</strong> Incluyen lápiz óptico + soporte ajustable + cable nuevos de regalo.
                </span>
              </div>
            </div>

            {/* 4 Pillars Grid */}
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Emitimos Boleta de Venta
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  Comprobante legal por tu compra. Equipos de segunda mano seleccionados con total transparencia comercial.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="text-emerald-400 font-bold text-sm flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  30 Puntos Testeados
                </div>
                <p className="text-xs text-slate-300 leading-snug">
                  Wi-Fi, altavoces, cámaras, Touch ID, pantalla, botones y sensores 100% operativos. Detalles en observación.
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

          {/* Interactive Cover Footer */}
          <div className="relative z-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-300 gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-white">📲 Contacto Directo:</span>
              <a
                href="https://wa.me/51907674693"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
              >
                +51 907 674 693
              </a>
              <span>•</span>
              <a
                href="https://wa.me/51924967876"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
              >
                +51 924 967 876
              </a>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://www.tiktok.com/@itechperu"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white font-semibold hover:underline"
              >
                TikTok: <strong>@itechperu</strong>
              </a>
              <span>•</span>
              <a
                href="https://www.itechperu.shop"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-bold hover:underline"
              >
                www.itechperu.shop
              </a>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PAGES 2+: CONSOLIDATED PRODUCT CATALOG ITEMS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <section className="pt-6 space-y-12">
          {/* LAPTOPS & MACBOOKS */}
          {laptops.length > 0 && (
            <div>
              <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-3 mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-600" />
                    Laptops & Apple MacBooks ({laptops.length} Modelos • {laptops.reduce((a, b) => a + b.stockCount, 0)} Unidades)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Equipos de alto rendimiento para programación, diseño, oficina y universidad
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                  🎁 Incluye Funda Portalaptop de Regalo
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                {laptops.map((item, idx) => (
                  <CatalogItemCard key={item.commercialTitle || idx} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* TABLETS & IPADS */}
          {tablets.length > 0 && (
            <div>
              <div className="flex items-center justify-between border-b-2 border-teal-600 pb-3 mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-teal-600" />
                    Apple iPads & Tablets ({tablets.length} Modelos • {tablets.reduce((a, b) => a + b.stockCount, 0)} Unidades)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pantallas Retina ultranítidas para estudio, diseño digital, streaming y productividad
                  </p>
                </div>
                <span className="text-xs font-bold text-teal-800 bg-teal-100 px-3 py-1 rounded-full border border-teal-200">
                  🎁 Incluye Pack: Lápiz + Soporte + Cable
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                {tablets.map((item, idx) => (
                  <CatalogItemCard key={item.commercialTitle || idx} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* ACCESSORIES */}
          {accessories.length > 0 && (
            <div>
              <div className="flex items-center justify-between border-b-2 border-slate-700 pb-3 mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-slate-700" />
                    Accesorios & Repuestos ({accessories.length} Artículos)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cargadores rápidos certificados y componentes garantizados
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-700 bg-slate-200 px-3 py-1 rounded-full">
                  100% Nuevos y Garantizados
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                {accessories.map((item, idx) => (
                  <CatalogItemCard key={item.commercialTitle || idx} item={item} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* PRINT FOOTER */}
        <div className="border-t-2 border-slate-300 pt-8 mt-12 text-center text-xs text-slate-600 print:text-[10px] space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-4 font-bold text-slate-800">
            <a href="https://www.itechperu.shop" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600">
              🌐 www.itechperu.shop
            </a>
            <span>•</span>
            <a href="https://wa.me/51907674693" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600">
              📲 WhatsApp Ventas: +51 907 674 693 / +51 924 967 876
            </a>
            <span>•</span>
            <a href="https://www.tiktok.com/@itechperu" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600">
              🎵 TikTok Live: @itechperu
            </a>
          </div>
          <p className="text-slate-500">
            iTech Perú • RUC 20608546193 • Importaciones Directas USA • Precios en Soles (PEN) sujetos a disponibilidad de inventario.
          </p>
          <p className="text-[11px] text-slate-400">
            Los enlaces y números de este catálogo son interactivos. Haz clic en cualquier producto o botón de WhatsApp para separar tu equipo en vivo.
          </p>
        </div>
      </div>
    </div>
  );
}

function CatalogItemCard({ item }: { item: GroupedCatalogItem }) {
  const whatsappUrl = `https://wa.me/51907674693?text=${encodeURIComponent(
    `Hola iTech Perú! Vi en el Catálogo el equipo: *${item.commercialTitle}* (Precio Oferta: S/ ${item.salePricePen} PEN). Deseo coordinar la compra y verificar disponibilidad inmediata.`
  )}`;

  return (
    <div
      className="bg-white rounded-2xl border-2 border-slate-200 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow print:shadow-none print:border-slate-300 print:break-inside-avoid print:mb-6"
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      <div className="space-y-4">
        {/* Header: Category & Real Stock Count Badge */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] uppercase tracking-wider">
              {item.category}
            </span>
            <span className="text-xs font-bold text-slate-600">
              {item.brand}
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-0.5 rounded-full border ${
              item.stockCount > 1
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                item.stockCount > 1 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {item.stockCount > 1
              ? `Stock: ${item.stockCount} unidades disponibles`
              : '¡Última unidad disponible!'}
          </span>
        </div>

        {/* Large 1080x1080 Image Container (Centered, High-Res, No Cuts) */}
        <div className="w-full aspect-square max-h-72 bg-white rounded-xl p-3 flex items-center justify-center border border-slate-100 shadow-inner overflow-hidden group">
          <img
            src={item.cdnImg}
            alt={item.commercialTitle}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            crossOrigin="anonymous"
          />
        </div>

        {/* Clean Commercial Title (No internal order codes) */}
        <div>
          <a
            href="https://www.itechperu.shop/coleccion"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-slate-900 text-base leading-snug hover:text-emerald-600 transition-colors block"
          >
            {item.commercialTitle}
          </a>
        </div>

        {/* Complete Technical Specifications Grid (Zero Truncation) */}
        <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-600 shrink-0 flex items-center gap-1">
              <Monitor className="w-3.5 h-3.5 text-emerald-600" /> Pantalla:
            </span>
            <span className="text-slate-800 leading-tight font-medium">{item.displaySpecs}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-600 shrink-0 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-emerald-600" /> Procesador:
            </span>
            <span className="text-slate-800 leading-tight font-medium">{item.cpuSpecs}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-600 shrink-0 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-600" /> Memoria:
            </span>
            <span className="text-slate-900 font-extrabold">{item.ramSpecs}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-slate-600 shrink-0 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-emerald-600" /> Almacenamiento:
            </span>
            <span className="text-slate-900 font-extrabold">{item.storageSpecs}</span>
          </div>
          <div className="flex items-start gap-2 pt-1 border-t border-slate-200">
            <span className="font-bold text-slate-600 shrink-0">✨ Estado & Regalos:</span>
            <span className="text-emerald-800 font-bold leading-tight">{item.conditionLabel}</span>
          </div>
        </div>
      </div>

      {/* Pricing & Interactive WhatsApp Reservation */}
      <div className="pt-4 border-t border-slate-200 mt-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xs text-slate-400 line-through block font-medium">
              S/ {Number(item.regularPricePen).toLocaleString('es-PE')}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-700">
                S/ {Number(item.salePricePen).toLocaleString('es-PE')}
              </span>
              <span className="text-xs font-black text-slate-500 uppercase">
                PEN (Oferta)
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Emitimos Boleta
            </span>
          </div>
        </div>

        {/* Primary Interactive WhatsApp Hyperlink Button */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs tracking-wide shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] print:bg-emerald-700 print:text-white"
        >
          <MessageCircle className="w-4 h-4" />
          <span>📲 Separar por WhatsApp (+51 907 674 693)</span>
        </a>

        {/* Secondary Web Link */}
        <a
          href="https://www.itechperu.shop/coleccion"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-emerald-600 font-semibold text-center hover:underline transition-colors"
        >
          <span>🌐 Ver disponibilidad en www.itechperu.shop</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
