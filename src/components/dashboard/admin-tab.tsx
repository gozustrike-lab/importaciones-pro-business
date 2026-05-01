'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  Shield,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Loader2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

// ── Types ───────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string;
  name: string;
  ruc: string;
  ownerName: string;
  ownerEmail: string;
  plan: string;
  isActive: boolean;
  maxUsers: number;
  userCount: number;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string | null;
  tenantName: string | null;
  isActive: boolean;
  lastLogin: string | null;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminTabProps {
  onNavigate?: (tab: string) => void;
}

// ── Badge Helpers ───────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant={active ? 'default' : 'destructive'}
      className={
        active
          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
          : undefined
      }
    >
      {active ? 'Activo' : 'Inactivo'}
    </Badge>
  );
}

function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case 'SUPER_ADMIN':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200">
          <Shield className="h-3 w-3 mr-1" />
          SUPER_ADMIN
        </Badge>
      );
    case 'TENANT_ADMIN':
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200">
          <Shield className="h-3 w-3 mr-1" />
          TENANT_ADMIN
        </Badge>
      );
    case 'TENANT_USER':
    default:
      return (
        <Badge variant="secondary">TENANT_USER</Badge>
      );
  }
}

function PlanBadge({ plan }: { plan: string }) {
  const planStyles: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700 border-gray-300',
    pro: 'bg-amber-100 text-amber-700 border-amber-300',
    enterprise: 'bg-purple-100 text-purple-700 border-purple-300',
  };
  return (
    <Badge className={planStyles[plan] ?? planStyles.free}>
      {plan.toUpperCase()}
    </Badge>
  );
}

// ── Skeleton Loader ─────────────────────────────────────────────────────────

function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create User Dialog ──────────────────────────────────────────────────────

function CreateUserDialog({
  open,
  onOpenChange,
  tenants,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenants: TenantRow[];
  onSubmit: (data: {
    email: string;
    name: string;
    password: string;
    role: string;
    tenantId: string;
  }) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('TENANT_USER');
  const [tenantId, setTenantId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim() || !password.trim()) return;
    onSubmit({ email, name, password, role, tenantId });
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setEmail('');
      setName('');
      setPassword('');
      setRole('TENANT_USER');
      setTenantId('');
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          <DialogDescription>
            Agrega un nuevo usuario al sistema. Asigna un tenant y rol
            apropiados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-user-name">Nombre Completo *</Label>
            <Input
              id="new-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Pérez"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-email">Email *</Label>
            <Input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-password">Contraseña *</Label>
            <Input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TENANT_USER">TENANT_USER</SelectItem>
                  <SelectItem value="TENANT_ADMIN">TENANT_ADMIN</SelectItem>
                  <SelectItem value="SUPER_ADMIN">SUPER_ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={tenantId} onValueChange={setTenantId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !email.trim() ||
                !name.trim() ||
                !password.trim()
              }
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Usuario'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function AdminTab({ onNavigate }: AdminTabProps) {
  const { toast } = useToast();

  // Data state
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // UI state
  const [tenantFilter, setTenantFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [togglingTenant, setTogglingTenant] = useState<string | null>(null);
  const [togglingUser, setTogglingUser] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  // ── Data Fetching ────────────────────────────────────────────────────────

  const loadTenants = useCallback(async () => {
    try {
      setLoadingTenants(true);
      const res = await fetch('/api/admin/tenants');
      if (!res.ok) throw new Error('Error al cargar tenants');
      const data = await res.json();
      setTenants(data);
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los tenants',
        variant: 'destructive',
      });
    } finally {
      setLoadingTenants(false);
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Error al cargar usuarios');
      const data = await res.json();
      setUsers(data);
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios',
        variant: 'destructive',
      });
    } finally {
      setLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTenants();
    loadUsers();
  }, [loadTenants, loadUsers]);

  // ── KPI Calculations ──────────────────────────────────────────────────────

  const kpis = {
    totalTenants: tenants.length,
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive).length,
    inactiveTenants: tenants.filter((t) => !t.isActive).length,
  };

  // ── Filtered Tenants ─────────────────────────────────────────────────────

  const filteredTenants = tenants.filter((t) => {
    if (tenantFilter === 'active') return t.isActive;
    if (tenantFilter === 'inactive') return !t.isActive;
    return true;
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleTenant = async (id: string, currentActive: boolean) => {
    try {
      setTogglingTenant(id);
      const res = await fetch('/api/admin/tenants', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'SUPER_ADMIN',
        },
        body: JSON.stringify({ id, isActive: !currentActive }),
      });
      if (!res.ok) throw new Error('Error al actualizar tenant');
      toast({
        title: 'Tenant actualizado',
        description: `El tenant ha sido ${!currentActive ? 'activado' : 'desactivado'}`,
      });
      await loadTenants();
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el tenant',
        variant: 'destructive',
      });
    } finally {
      setTogglingTenant(null);
    }
  };

  const handleToggleUser = async (id: string, currentActive: boolean) => {
    try {
      setTogglingUser(id);
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'SUPER_ADMIN',
        },
        body: JSON.stringify({ id, isActive: !currentActive }),
      });
      if (!res.ok) throw new Error('Error al actualizar usuario');
      toast({
        title: 'Usuario actualizado',
        description: `El usuario ha sido ${!currentActive ? 'activado' : 'desactivado'}`,
      });
      await loadUsers();
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el usuario',
        variant: 'destructive',
      });
    } finally {
      setTogglingUser(null);
    }
  };

  const handleCreateUser = async (data: {
    email: string;
    name: string;
    password: string;
    role: string;
    tenantId: string;
  }) => {
    try {
      setCreatingUser(true);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'SUPER_ADMIN',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al crear usuario');
      }
      toast({
        title: 'Usuario creado',
        description: `${data.name} ha sido creado exitosamente`,
      });
      setCreateUserOpen(false);
      await loadUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo crear el usuario';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCreatingUser(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatLastLogin = (dateStr: string | null) => {
    if (!dateStr) return (
      <span className="text-muted-foreground text-xs">Nunca</span>
    );
    return (
      <span className="text-xs">
        {new Date(dateStr).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-600" />
            Super Admin Panel
          </h2>
          <p className="text-muted-foreground">
            Gestión centralizada de tenants y usuarios del sistema
          </p>
        </div>
        <Button
          onClick={() => setCreateUserOpen(true)}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingTenants || loadingUsers ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-100 p-2.5">
                    <Building2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{kpis.totalTenants}</p>
                    <p className="text-xs text-muted-foreground">
                      Total Tenants
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-100 p-2.5">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{kpis.totalUsers}</p>
                    <p className="text-xs text-muted-foreground">
                      Total Usuarios
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-sky-100 p-2.5">
                    <ToggleRight className="h-5 w-5 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{kpis.activeUsers}</p>
                    <p className="text-xs text-muted-foreground">
                      Usuarios Activos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-100 p-2.5">
                    <ToggleLeft className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {kpis.inactiveTenants}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tenants Inactivos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── Tenants Section ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                Tenants
              </CardTitle>
              <CardDescription>
                Empresas registradas en la plataforma
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="tenant-filter" className="text-xs text-muted-foreground">
                Filtrar:
              </Label>
              <Select
                value={tenantFilter}
                onValueChange={(v) =>
                  setTenantFilter(v as 'all' | 'active' | 'inactive')
                }
              >
                <SelectTrigger id="tenant-filter" className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingTenants ? (
            <TableSkeleton rows={4} cols={7} />
          ) : filteredTenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Building2 className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No hay tenants</p>
              <p className="text-sm">
                {tenantFilter !== 'all'
                  ? `No se encontraron tenants ${tenantFilter === 'active' ? 'activos' : 'inactivos'}`
                  : 'Aún no hay empresas registradas en el sistema'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>RUC</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-center">Usuarios</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{t.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {t.ownerName}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {t.ruc}
                      </TableCell>
                      <TableCell>
                        <PlanBadge plan={t.plan} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">
                          {t.userCount}/{t.maxUsers}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge active={t.isActive} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(t.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 gap-1.5 text-xs ${
                            t.isActive
                              ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                              : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                          }`}
                          onClick={() =>
                            handleToggleTenant(t.id, t.isActive)
                          }
                          disabled={togglingTenant === t.id}
                        >
                          {togglingTenant === t.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : t.isActive ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                          {t.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Users Section ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            Usuarios
          </CardTitle>
          <CardDescription>
            Todos los usuarios registrados en el sistema multi-tenant
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadingUsers ? (
            <TableSkeleton rows={6} cols={7} />
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No hay usuarios</p>
              <p className="text-sm">
                Aún no hay usuarios registrados en el sistema
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{u.name}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={u.role} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.tenantName ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge active={u.isActive} />
                      </TableCell>
                      <TableCell>{formatLastLogin(u.lastLogin)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 gap-1.5 text-xs ${
                            u.isActive
                              ? 'text-red-500 hover:text-red-700 hover:bg-red-50'
                              : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                          }`}
                          onClick={() =>
                            handleToggleUser(u.id, u.isActive)
                          }
                          disabled={togglingUser === u.id}
                        >
                          {togglingUser === u.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : u.isActive ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                          {u.isActive ? 'Desactivar' : 'Activar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create User Dialog ───────────────────────────────────────────────── */}
      <CreateUserDialog
        open={createUserOpen}
        onOpenChange={setCreateUserOpen}
        tenants={tenants.filter((t) => t.isActive)}
        onSubmit={handleCreateUser}
        loading={creatingUser}
      />
    </div>
  );
}
