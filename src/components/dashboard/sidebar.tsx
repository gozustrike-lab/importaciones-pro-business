'use client';

import { cn } from '@/lib/utils';
import { useSession, signOut } from 'next-auth/react';
import {
  Package,
  LayoutDashboard,
  Receipt,
  TrendingUp,
  CheckSquare,
  Truck,
  Users,
  ShoppingCart,
  BarChart3,
  Menu,
  Shield,
  LogOut,
  ChevronDown,
  Store,
  Sun,
  Moon,
  Plane,
  FileSpreadsheet,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { useTheme } from '@/components/theme-provider';
import { NotificationsDialog } from '@/components/dashboard/notifications-dialog';

export type TabKey =
  | 'dashboard'
  | 'proveedores'
  | 'productos'
  | 'compras'
  | 'clientes'
  | 'ventas'
  | 'analitica'
  | 'impuestos'
  | 'nrus'
  | 'calidad'
  | 'tracking'
  | 'shipper'
  | 'admin';

interface SidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  userRole?: string;
  session?: any;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const navItems: {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  section?: string;
  adminOnly?: boolean;
  badge?: string;
}[] = [
  { key: 'productos', label: 'Inventario & Importaciones', icon: Package, section: 'Principal', badge: 'Live' },
  { key: 'shipper', label: 'Bitácora & Shipper', icon: Plane, section: 'Principal' },
  { key: 'compras', label: 'Registro Compras & Excel', icon: FileSpreadsheet, section: 'Principal' },
  { key: 'nrus', label: 'NRUS / SUNAT', icon: TrendingUp, section: 'Principal' },
  { key: 'ventas', label: 'Registro Ventas', icon: ShoppingCart, section: 'Principal' },
  { key: 'proveedores', label: 'Proveedores & Ofertas', icon: Store, section: 'Principal' },
  { key: 'dashboard', label: 'Panel General', icon: LayoutDashboard, section: 'Secundario' },
  { key: 'clientes', label: 'CRM Clientes', icon: Users, section: 'Secundario' },
  { key: 'impuestos', label: 'Impuestos', icon: Receipt, section: 'Secundario' },
  { key: 'tracking', label: 'Tracking USA', icon: Truck, section: 'Secundario' },
  { key: 'calidad', label: 'Control Calidad', icon: CheckSquare, section: 'Secundario' },
  { key: 'analitica', label: 'Analítica Utilidad', icon: BarChart3, section: 'Secundario' },
  { key: 'admin', label: 'Super Admin', icon: Shield, section: 'Admin', adminOnly: true },
];

function NavItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex w-full items-center rounded-lg text-sm font-medium transition-all min-h-[42px]',
        collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
        active
          ? 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', active && 'text-emerald-600 dark:text-emerald-400')} />
      {!collapsed && (
        <span className="truncate flex-1 text-left">{item.label}</span>
      )}
      {!collapsed && item.badge && (
        <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.2 rounded font-bold">
          {item.badge}
        </span>
      )}
    </button>
  );
}

function UserSection({
  session,
  collapsed,
  onLogout,
}: {
  session?: any;
  collapsed?: boolean;
  onLogout: () => void;
}) {
  const userName = session?.user?.name || 'Usuario';
  const userEmail = session?.user?.email || '';
  const userRole = (session?.user as { role?: string })?.role || 'TENANT_USER';

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    TENANT_ADMIN: 'Admin Empresa',
    TENANT_USER: 'Usuario',
  };

  if (collapsed) {
    return (
      <div className="border-t p-2 flex flex-col items-center gap-2">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold shrink-0 cursor-pointer"
          title={`${userName} (${roleLabels[userRole] || userRole})`}
        >
          {userName.charAt(0).toUpperCase()}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onLogout}
          className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-accent"
          title="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold shrink-0">
          {userName.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{userName}</p>
          <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {roleLabels[userRole] || userRole}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="h-7 px-2 text-muted-foreground hover:text-red-500 hover:bg-accent"
          title="Cerrar sesión"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SidebarContent({
  activeTab,
  onTabChange,
  userRole,
  session,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const isAdmin = userRole === 'SUPER_ADMIN';

  // Filter nav items based on role
  const filteredItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  // Group items by section
  const mainItems = filteredItems.filter((i) => i.section === 'Principal');
  const secondaryItems = filteredItems.filter((i) => i.section === 'Secundario');
  const adminItems = filteredItems.filter((i) => i.section === 'Admin');

  const isSecondaryActive = secondaryItems.some((i) => i.key === activeTab);
  const [showMore, setShowMore] = useState(false);
  const expandedMore = showMore || isSecondaryActive;

  return (
    <div className="flex h-full flex-col">
      {/* Header / Logo */}
      <div className={cn('p-4 transition-all', collapsed ? 'px-2 py-4' : 'p-5')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 shrink-0 shadow-xs">
              <Package className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-base font-bold text-foreground leading-tight truncate">
                  ImportHub Perú
                </h1>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5">ERP Multi-Tenant</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {!collapsed && (
              <button
                onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}

            {/* Desktop Collapse Toggle Button */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title={collapsed ? 'Desplegar menú' : 'Plegar menú (más espacio)'}
              >
                {collapsed ? (
                  <PanelLeftOpen className="h-4 w-4 text-emerald-600" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className={cn('flex-1 space-y-1 overflow-y-auto', collapsed ? 'p-2' : 'p-3')}>
        {!collapsed && (
          <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 px-3 mb-1.5 mt-1">
            Operación Diaria
          </p>
        )}
        {mainItems.map((item) => (
          <NavItem
            key={item.key}
            item={item}
            active={activeTab === item.key}
            collapsed={collapsed}
            onClick={() => onTabChange(item.key)}
          />
        ))}

        {/* Collapsible Secondary Modules ("Menos es Más") */}
        <div className="pt-2">
          {collapsed ? (
            <Separator className="my-2" />
          ) : (
            <button
              type="button"
              onClick={() => setShowMore((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-[11px] uppercase font-bold tracking-wider text-muted-foreground hover:text-foreground rounded-md hover:bg-accent/50 transition-colors"
            >
              <span>Más Herramientas ({secondaryItems.length})</span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 transition-transform duration-200',
                  expandedMore && 'rotate-180'
                )}
              />
            </button>
          )}

          {(expandedMore || collapsed) && (
            <div className={cn('space-y-1', !collapsed && 'mt-1 pl-1 border-l border-border/60 ml-2')}>
              {secondaryItems.map((item) => (
                <NavItem
                  key={item.key}
                  item={item}
                  active={activeTab === item.key}
                  collapsed={collapsed}
                  onClick={() => onTabChange(item.key)}
                />
              ))}
            </div>
          )}
        </div>

        {isAdmin && adminItems.length > 0 && (
          <>
            {collapsed ? (
              <Separator className="my-2" />
            ) : (
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-1.5">
                Admin
              </p>
            )}
            {adminItems.map((item) => (
              <NavItem
                key={item.key}
                item={item}
                active={activeTab === item.key}
                collapsed={collapsed}
                onClick={() => onTabChange(item.key)}
              />
            ))}
          </>
        )}
      </nav>

      {/* Bot Alertas Celular (WhatsApp & Telegram) */}
      <div className={cn('px-3 py-1.5', collapsed ? 'px-2' : 'px-3')}>
        <NotificationsDialog
          triggerButton={
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'w-full gap-2 border-emerald-500/30 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-100/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold text-xs transition-all shadow-xs',
                collapsed && 'px-0 justify-center'
              )}
              title="Configurar Bot de Notificaciones (WhatsApp & Telegram)"
            >
              <Bell className="h-3.5 w-3.5 text-emerald-600 animate-bounce" />
              {!collapsed && <span>Alertas Celular</span>}
            </Button>
          }
        />
      </div>

      {/* User info + logout */}
      <UserSection
        session={session}
        collapsed={collapsed}
        onLogout={() => signOut({ callbackUrl: '/login' })}
      />
    </div>
  );
}

export function Sidebar({
  activeTab,
  onTabChange,
  userRole = 'TENANT_USER',
  session,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleTabChange = (tab: TabKey) => {
    onTabChange(tab);
    setMobileOpen(false); // Close mobile sidebar after click
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-background border-r z-40 transition-all duration-200',
          collapsed ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        <SidebarContent
          activeTab={activeTab}
          onTabChange={onTabChange}
          userRole={userRole}
          session={session}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
        />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-50 lg:hidden bg-background shadow-md border text-foreground hover:bg-accent"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Menú</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0 bg-background border">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SidebarContent
            activeTab={activeTab}
            onTabChange={handleTabChange}
            userRole={userRole}
            session={session}
            collapsed={false}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
