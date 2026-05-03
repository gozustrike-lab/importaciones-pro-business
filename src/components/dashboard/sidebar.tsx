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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { useTheme } from '@/components/theme-provider';

export type TabKey = 'dashboard' | 'proveedores' | 'productos' | 'clientes' | 'ventas' | 'analitica' | 'impuestos' | 'nrus' | 'calidad' | 'tracking' | 'admin';

interface SidebarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  userRole?: string;
  session?: any;
}

const navItems: { key: TabKey; label: string; icon: React.ElementType; section?: string; adminOnly?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Principal' },
  { key: 'proveedores', label: 'Proveedores', icon: Store },
  { key: 'productos', label: 'Inventario', icon: Package },
  { key: 'clientes', label: 'CRM Clientes', icon: Users },
  { key: 'ventas', label: 'Registro Ventas', icon: ShoppingCart },
  { key: 'analitica', label: 'Analítica Utilidad', icon: BarChart3 },
  { key: 'impuestos', label: 'Impuestos', icon: Receipt, section: 'Fiscal' },
  { key: 'nrus', label: 'NRUS / SUNAT', icon: TrendingUp },
  { key: 'calidad', label: 'Calidad', icon: CheckSquare, section: 'Operaciones' },
  { key: 'tracking', label: 'Tracking', icon: Truck },
  { key: 'admin', label: 'Super Admin', icon: Shield, section: 'Admin', adminOnly: true },
];

function NavItem({
  item,
  active,
  onClick,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors min-h-[44px]',
        active
          ? 'bg-emerald-600/20 text-emerald-600 dark:text-emerald-400'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {item.label}
    </button>
  );
}

function UserSection({ session, onLogout }: { session?: any; onLogout: () => void }) {
  const userName = session?.user?.name || 'Usuario';
  const userEmail = session?.user?.email || '';
  const userRole = (session?.user as { role?: string })?.role || 'TENANT_USER';

  const roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    TENANT_ADMIN: 'Admin Empresa',
    TENANT_USER: 'Usuario',
  };

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
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function SidebarContent({ activeTab, onTabChange, userRole, session }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const isAdmin = userRole === 'SUPER_ADMIN';

  // Filter nav items based on role
  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  // Group items by section
  const mainItems = filteredItems.filter(i => i.section === 'Principal' || (!i.section && !i.adminOnly));
  const fiscalItems = filteredItems.filter(i => i.section === 'Fiscal');
  const opsItems = filteredItems.filter(i => i.section === 'Operaciones');
  const adminItems = filteredItems.filter(i => i.section === 'Admin');

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">ImportHub Perú</h1>
            <p className="text-xs text-muted-foreground">ERP Multi-Tenant</p>
          </div>
          <button
            onClick={toggleTheme}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mb-2">Principal</p>
        {mainItems.map((item) => (
          <NavItem key={item.key} item={item} active={activeTab === item.key} onClick={() => onTabChange(item.key)} />
        ))}

        <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-2">Fiscal</p>
        {fiscalItems.map((item) => (
          <NavItem key={item.key} item={item} active={activeTab === item.key} onClick={() => onTabChange(item.key)} />
        ))}

        <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-2">Operaciones</p>
        {opsItems.map((item) => (
          <NavItem key={item.key} item={item} active={activeTab === item.key} onClick={() => onTabChange(item.key)} />
        ))}

        {isAdmin && adminItems.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mt-4 mb-2">Admin</p>
            {adminItems.map((item) => (
              <NavItem key={item.key} item={item} active={activeTab === item.key} onClick={() => onTabChange(item.key)} />
            ))}
          </>
        )}
      </nav>

      {/* User info + logout */}
      <UserSection
        session={session}
        onLogout={() => signOut({ callbackUrl: '/login' })}
      />
    </div>
  );
}

export function Sidebar({ activeTab, onTabChange, userRole = 'TENANT_USER', session }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleTabChange = (tab: TabKey) => {
    onTabChange(tab);
    setMobileOpen(false); // Close mobile sidebar after click
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-background border-r z-40">
        <SidebarContent activeTab={activeTab} onTabChange={onTabChange} userRole={userRole} session={session} />
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
          <SidebarContent activeTab={activeTab} onTabChange={handleTabChange} userRole={userRole} session={session} />
        </SheetContent>
      </Sheet>
    </>
  );
}
