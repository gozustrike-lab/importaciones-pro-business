'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { Sidebar, type TabKey } from '@/components/dashboard/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';
import {
  ShieldCheck,
  FileSpreadsheet,
  Smartphone,
  Package,
  Mic,
  TrendingUp,
  Menu,
  Sun,
  Moon,
  Plane,
} from 'lucide-react';

// Lazy load all tab components for performance
const LogisticaSimpleTab = lazy(() => import('@/components/dashboard/logistica-simple-tab').then(m => ({ default: m.LogisticaSimpleTab })));
const DashboardTab = lazy(() => import('@/components/dashboard/dashboard-tab').then(m => ({ default: m.DashboardTab })));
const ProveedoresTab = lazy(() => import('@/components/dashboard/proveedores-tab').then(m => ({ default: m.ProveedoresTab })));
const ProductosTab = lazy(() => import('@/components/dashboard/productos-tab').then(m => ({ default: m.ProductosTab })));
const CatalogoTab = lazy(() => import('@/components/dashboard/catalogo-tab').then(m => ({ default: m.CatalogoTab })));
const ComprasTab = lazy(() => import('@/components/dashboard/compras-tab').then(m => ({ default: m.ComprasTab })));
const ClientesTab = lazy(() => import('@/components/dashboard/clientes-tab').then(m => ({ default: m.ClientesTab })));
const VentasTab = lazy(() => import('@/components/dashboard/ventas-tab').then(m => ({ default: m.VentasTab })));
const AnaliticaTab = lazy(() => import('@/components/dashboard/analitica-tab').then(m => ({ default: m.AnaliticaTab })));
const ImpuestosTab = lazy(() => import('@/components/dashboard/impuestos-tab').then(m => ({ default: m.ImpuestosTab })));
const NRUSTab = lazy(() => import('@/components/dashboard/nrus-tab').then(m => ({ default: m.NRUSTab })));
const CalidadTab = lazy(() => import('@/components/dashboard/calidad-tab').then(m => ({ default: m.CalidadTab })));
const TrackingTab = lazy(() => import('@/components/dashboard/tracking-tab').then(m => ({ default: m.TrackingTab })));
const ShipperTab = lazy(() => import('@/components/dashboard/shipper-tab').then(m => ({ default: m.ShipperTab })));
const AdminTab = lazy(() => import('@/components/dashboard/admin-tab').then(m => ({ default: m.AdminTab })));

const tabComponents: Record<TabKey, React.ComponentType<{ onNavigate?: (tab: string) => void }>> = {
  logistica: LogisticaSimpleTab,
  dashboard: DashboardTab,
  proveedores: ProveedoresTab,
  productos: ProductosTab,
  catalogo: CatalogoTab,
  compras: ComprasTab,
  clientes: ClientesTab,
  ventas: VentasTab,
  analitica: AnaliticaTab,
  impuestos: ImpuestosTab,
  nrus: NRUSTab,
  shipper: ShipperTab,
  calidad: CalidadTab,
  tracking: TrackingTab,
  admin: AdminTab,
};

const tabTitles: Record<TabKey, string> = {
  logistica: 'Control Logístico Simple',
  dashboard: 'Dashboard',
  proveedores: 'Proveedores',
  productos: 'Inventario',
  catalogo: 'Catálogo TikTok Live & WhatsApp',
  compras: 'Registro Compras & Logística',
  clientes: 'CRM Clientes',
  ventas: 'Registro Ventas',
  analitica: 'Analítica Utilidad',
  impuestos: 'Impuestos',
  nrus: 'NRUS / SUNAT',
  shipper: 'Embarques & Vuelos (ShiPer)',
  calidad: 'Calidad',
  tracking: 'Tracking',
  admin: 'Super Admin',
};

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-4 w-64 bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36 bg-slate-200 dark:bg-slate-800" />
          <Skeleton className="h-10 w-36 bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
      <Skeleton className="h-16 w-full bg-slate-200 dark:bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl bg-slate-200/80 dark:bg-slate-800/60" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabKey>('logistica');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('importHub_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
      const params = new URLSearchParams(window.location.search);
      const urlTab = params.get('tab') as TabKey | null;
      if (urlTab && tabComponents[urlTab]) {
        setActiveTab(urlTab);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('importHub_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const userRole = (session?.user as { role?: string })?.role || 'TENANT_USER';
  const ActiveComponent = tabComponents[activeTab];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-[#070D19] dark:text-slate-100 flex flex-col transition-colors duration-150">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userRole={userRole}
        session={session}
        collapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main Content */}
      <main
        className={cn(
          'transition-all duration-200 overflow-x-hidden min-h-screen flex-1 pb-24 lg:pb-8 bg-slate-100 text-slate-900 dark:bg-[#070D19] dark:text-slate-100',
          isCollapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        <div className="w-full max-w-[1900px] mx-auto p-3 pt-14 lg:p-7 lg:pt-5">
          {/* Mobile Top App Bar (Always instant with CSS lg:hidden) */}
          <div className="mb-3 flex lg:hidden items-center justify-between bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-2xl shadow-sm dark:shadow-md">
            <div className="flex items-center gap-2 min-w-0 pl-11">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-xs font-black text-slate-900 dark:text-white truncate">ImportHub</h1>
                  <span className="text-[9px] font-black px-1 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">PERÚ</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate leading-none mt-0.5">
                  {tabTitles[activeTab]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
              </button>

              <button
                onClick={() => {
                  setActiveTab('logistica');
                  window.dispatchEvent(new CustomEvent('open-quick-sale-modal'));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-950/20 active:scale-95 transition-all"
              >
                <Mic className="h-3.5 w-3.5 text-slate-950" />
                <span>Vender</span>
              </button>
            </div>
          </div>

          {/* Tab Content - Lazy Loaded */}
          <Suspense fallback={<TabSkeleton />}>
            <ActiveComponent onNavigate={(tab) => setActiveTab(tab as TabKey)} />
          </Suspense>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MOBILE BOTTOM NAVIGATION BAR (100% Mobile First & Thumb-Friendly) */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/90 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-bottom">
        {/* 1. Logística / Finanzas */}
        <button
          onClick={() => setActiveTab('logistica')}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all min-w-[56px]',
            activeTab === 'logistica'
              ? 'text-emerald-600 dark:text-emerald-400 font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          )}
        >
          <ShieldCheck className={cn('h-5 w-5 mb-0.5', activeTab === 'logistica' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400')} />
          <span>Logística</span>
        </button>

        {/* 2. Vuelos / Embarques */}
        <button
          onClick={() => setActiveTab('shipper')}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all min-w-[56px]',
            activeTab === 'shipper'
              ? 'text-emerald-600 dark:text-emerald-400 font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          )}
        >
          <Plane className={cn('h-5 w-5 mb-0.5', activeTab === 'shipper' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400')} />
          <span>Vuelos</span>
        </button>

        {/* 3. Central Elevated Action: Venta Rápida (Voz / Texto) */}
        <button
          onClick={() => {
            setActiveTab('logistica');
            window.dispatchEvent(new CustomEvent('open-quick-sale-modal'));
          }}
          className="flex flex-col items-center justify-center -mt-6 bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 h-12 w-12 rounded-full shadow-lg shadow-emerald-500/40 active:scale-90 transition-transform border-4 border-slate-100 dark:border-[#070D19]"
          title="Registrar Venta Rápida (Voz / Texto)"
        >
          <Mic className="h-5 w-5 text-slate-950" />
        </button>

        {/* 4. Inventario Stock */}
        <button
          onClick={() => setActiveTab('productos')}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all min-w-[56px]',
            activeTab === 'productos'
              ? 'text-emerald-600 dark:text-emerald-400 font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          )}
        >
          <Package className={cn('h-5 w-5 mb-0.5', activeTab === 'productos' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400')} />
          <span>Stock</span>
        </button>

        {/* 5. Catálogo TikTok / WA */}
        <button
          onClick={() => setActiveTab('catalogo')}
          className={cn(
            'flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-bold transition-all min-w-[56px]',
            activeTab === 'catalogo'
              ? 'text-emerald-600 dark:text-emerald-400 font-black'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          )}
        >
          <Smartphone className={cn('h-5 w-5 mb-0.5', activeTab === 'catalogo' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400')} />
          <span>Catálogo</span>
        </button>
      </nav>
    </div>
  );
}
