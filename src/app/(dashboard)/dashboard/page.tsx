'use client';

import { useState, lazy, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { Sidebar, type TabKey } from '@/components/dashboard/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load all tab components for performance
const DashboardTab = lazy(() => import('@/components/dashboard/dashboard-tab').then(m => ({ default: m.DashboardTab })));
const ProveedoresTab = lazy(() => import('@/components/dashboard/proveedores-tab').then(m => ({ default: m.ProveedoresTab })));
const ProductosTab = lazy(() => import('@/components/dashboard/productos-tab').then(m => ({ default: m.ProductosTab })));
const ClientesTab = lazy(() => import('@/components/dashboard/clientes-tab').then(m => ({ default: m.ClientesTab })));
const VentasTab = lazy(() => import('@/components/dashboard/ventas-tab').then(m => ({ default: m.VentasTab })));
const AnaliticaTab = lazy(() => import('@/components/dashboard/analitica-tab').then(m => ({ default: m.AnaliticaTab })));
const ImpuestosTab = lazy(() => import('@/components/dashboard/impuestos-tab').then(m => ({ default: m.ImpuestosTab })));
const NRUSTab = lazy(() => import('@/components/dashboard/nrus-tab').then(m => ({ default: m.NRUSTab })));
const CalidadTab = lazy(() => import('@/components/dashboard/calidad-tab').then(m => ({ default: m.CalidadTab })));
const TrackingTab = lazy(() => import('@/components/dashboard/tracking-tab').then(m => ({ default: m.TrackingTab })));
const AdminTab = lazy(() => import('@/components/dashboard/admin-tab').then(m => ({ default: m.AdminTab })));

const tabComponents: Record<TabKey, React.ComponentType<{ onNavigate?: (tab: string) => void }>> = {
  dashboard: DashboardTab,
  proveedores: ProveedoresTab,
  productos: ProductosTab,
  clientes: ClientesTab,
  ventas: VentasTab,
  analitica: AnaliticaTab,
  impuestos: ImpuestosTab,
  nrus: NRUSTab,
  calidad: CalidadTab,
  tracking: TrackingTab,
  admin: AdminTab,
};

const tabTitles: Record<TabKey, string> = {
  dashboard: 'Dashboard',
  proveedores: 'Proveedores',
  productos: 'Inventario',
  clientes: 'CRM Clientes',
  ventas: 'Registro Ventas',
  analitica: 'Analítica Utilidad',
  impuestos: 'Impuestos',
  nrus: 'NRUS / SUNAT',
  calidad: 'Calidad',
  tracking: 'Tracking',
  admin: 'Super Admin',
};

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const isMobile = useIsMobile();

  const userRole = (session?.user as { role?: string })?.role || 'TENANT_USER';

  const ActiveComponent = tabComponents[activeTab];

  return (
    <>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} userRole={userRole} session={session} />

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className={`mx-auto max-w-7xl ${isMobile ? 'p-4 pt-16' : 'p-6'}`}>
          {/* Mobile Header */}
          {isMobile && (
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-white">
                  <path d="M16.5 9.4 7.55 4.24"/>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.29 7 12 12 20.71 7"/>
                  <line x1="12" x2="12" y1="22" y2="12"/>
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-bold">ImportHub Perú</h1>
                <p className="text-xs text-muted-foreground">{tabTitles[activeTab]}</p>
              </div>
            </div>
          )}

          {/* Tab Content - Lazy Loaded */}
          <Suspense fallback={<TabSkeleton />}>
            <ActiveComponent onNavigate={(tab) => setActiveTab(tab as TabKey)} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
