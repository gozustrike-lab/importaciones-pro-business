'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Eye, Pencil, Trash2, Store, ExternalLink, Star,
  Globe, Mail, Phone, Link2, FileSpreadsheet, FileText, StickyNote,
  RefreshCw, Package, DollarSign, Upload, Loader2, X,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  fetchSuppliers, fetchSupplier, createSupplier, updateSupplier,
  deleteSupplier, createSupplierLink, syncSupplier, fetchEbayAccountStatus,
} from '@/lib/api';
import type {
  Supplier, SupplierDetail, SupplierFormData, SupplierLink,
  SupplierLinkFormData, SupplierCategory, SupplierLinkType, SupplierLinkStatus,
  EbayAccountStatus,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// ── Constants ──

const COUNTRY_FLAGS: Record<string, string> = {
  USA: '🇺🇸', CN: '🇨🇳', JP: '🇯🇵', KR: '🇰🇷', GB: '🇬🇧', DE: '🇩🇪',
  TW: '🇹🇼', HK: '🇭🇰', SG: '🇸🇬', IN: '🇮🇳', BR: '🇧🇷', MX: '🇲🇽', PE: '🇵🇪',
  US: '🇺🇸', China: '🇨🇳', Japan: '🇯🇵', Korea: '🇰🇷', UK: '🇬🇧', Germany: '🇩🇪',
};

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  electronics: 'Electrónica',
  accessories: 'Accesorios',
  components: 'Componentes',
  peripherals: 'Periféricos',
  cables: 'Cables',
  packaging: 'Empaque',
  other: 'Otro',
};

const COUNTRIES = [
  { value: 'US', label: '🇺🇸 Estados Unidos' },
  { value: 'CN', label: '🇨🇳 China' },
  { value: 'JP', label: '🇯🇵 Japón' },
  { value: 'KR', label: '🇰🇷 Corea' },
  { value: 'GB', label: '🇬🇧 Reino Unido' },
  { value: 'DE', label: '🇩🇪 Alemania' },
  { value: 'TW', label: '🇹🇼 Taiwán' },
  { value: 'HK', label: '🇭🇰 Hong Kong' },
  { value: 'SG', label: '🇸🇬 Singapur' },
  { value: 'IN', label: '🇮🇳 India' },
  { value: 'BR', label: '🇧🇷 Brasil' },
  { value: 'PE', label: '🇵🇪 Perú' },
];

const LINK_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  url: { label: 'URL', icon: Globe, color: 'bg-blue-100 text-blue-700 border-blue-300' },
  excel: { label: 'Excel', icon: FileSpreadsheet, color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  document: { label: 'Documento', icon: FileText, color: 'bg-orange-100 text-orange-700 border-orange-300' },
  note: { label: 'Nota', icon: StickyNote, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
};

const LINK_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Activo', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  discontinued: { label: 'Descatalogado', color: 'bg-red-100 text-red-700 border-red-300' },
  out_of_stock: { label: 'Sin Stock', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
};

// ── Helper: Stars ──
function RatingStars({ rating, onRate, size = 'sm' }: { rating: number; onRate?: (r: number) => void; size?: 'sm' | 'md' }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const val = i + 1;
        const filled = val <= (hovered || rating);
        return (
          <button
            key={i}
            type="button"
            className={`${onRate ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
            onMouseEnter={() => onRate && setHovered(val)}
            onMouseLeave={() => onRate && setHovered(0)}
            onClick={() => onRate && onRate(val)}
          >
            <Star
              className={`${size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'} ${
                filled ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-300'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function getCountryFlag(country: string): string {
  return COUNTRY_FLAGS[country] || '';
}

// ── Main Component ──
export function ProveedoresTab() {
  const { toast } = useToast();

  // List state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Dialogs state
  const [formOpen, setFormOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Detail dialog
  const [detailSupplier, setDetailSupplier] = useState<SupplierDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Link dialog
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkSaving, setLinkSaving] = useState(false);

  // eBay status
  const [ebayStatus, setEbayStatus] = useState<EbayAccountStatus | null>(null);
  const [ebayDialogOpen, setEbayDialogOpen] = useState(false);

  // Load suppliers
  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSuppliers();
      setSuppliers(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los proveedores', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load eBay status
  const loadEbayStatus = useCallback(async () => {
    try {
      const data = await fetchEbayAccountStatus();
      setEbayStatus(data);
    } catch {
      setEbayStatus({ configured: false, connected: false });
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
    loadEbayStatus();
  }, [loadSuppliers, loadEbayStatus]);

  // Filter suppliers
  const filteredSuppliers = suppliers.filter((s) => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.website.toLowerCase().includes(search.toLowerCase()) ||
      s.contactEmail.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || s.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  // Save supplier
  const handleSave = async (data: SupplierFormData) => {
    try {
      setSaving(true);
      if (editSupplier) {
        await updateSupplier(editSupplier.id, data);
        toast({ title: 'Proveedor actualizado', description: 'Los cambios se guardaron correctamente.' });
      } else {
        await createSupplier(data);
        toast({ title: 'Proveedor creado', description: 'El proveedor se agregó correctamente.' });
      }
      setFormOpen(false);
      setEditSupplier(null);
      await loadSuppliers();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el proveedor', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Delete supplier
  const handleDelete = async (id: string) => {
    try {
      await deleteSupplier(id);
      toast({ title: 'Proveedor eliminado', description: 'El proveedor se eliminó correctamente.' });
      setDeleteConfirm(null);
      await loadSuppliers();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar el proveedor', variant: 'destructive' });
    }
  };

  // Open detail
  const handleViewDetail = async (supplier: Supplier) => {
    try {
      setDetailOpen(true);
      setDetailLoading(true);
      const detail = await fetchSupplier(supplier.id);
      setDetailSupplier(detail);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el detalle del proveedor', variant: 'destructive' });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Sync supplier
  const handleSync = async (id: string) => {
    try {
      toast({ title: 'Sincronizando...', description: 'Iniciando sincronización del proveedor' });
      await syncSupplier(id);
      toast({ title: 'Sincronizado', description: 'Proveedor sincronizado correctamente.' });
      await loadSuppliers();
    } catch {
      toast({ title: 'Error', description: 'No se pudo sincronizar el proveedor', variant: 'destructive' });
    }
  };

  // Add link
  const handleAddLink = async (data: SupplierLinkFormData) => {
    if (!detailSupplier) return;
    try {
      setLinkSaving(true);
      await createSupplierLink(detailSupplier.id, data);
      toast({ title: 'Enlace agregado', description: 'El enlace se agregó correctamente.' });
      setLinkFormOpen(false);
      // Refresh detail
      const detail = await fetchSupplier(detailSupplier.id);
      setDetailSupplier(detail);
    } catch {
      toast({ title: 'Error', description: 'No se pudo agregar el enlace', variant: 'destructive' });
    } finally {
      setLinkSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Proveedores</h2>
          <p className="text-muted-foreground">Gestión de proveedores y enlaces de productos</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => toast({ title: 'Próximamente', description: 'La importación desde Excel estará disponible pronto.' })}
            variant="outline"
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Importar desde Excel
          </Button>
          <Button
            onClick={() => {
              setEditSupplier(null);
              setFormOpen(true);
            }}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo Proveedor
          </Button>
        </div>
      </div>

      {/* eBay Connection Card */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 dark:border-orange-900">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-600">
                <Store className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">eBay — Conexión de Cuenta</h3>
                <p className="text-xs text-muted-foreground">
                  {ebayStatus?.configured
                    ? ebayStatus.connected
                      ? `Conectado como ${ebayStatus.username}`
                      : 'API configurada. Conecta tu cuenta para ver compras y calificaciones.'
                    : 'API no configurada. Configura tus API keys de eBay.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {ebayStatus?.connected ? (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                  ✓ Conectado
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/40"
                  onClick={() => setEbayDialogOpen(true)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Conectar cuenta eBay
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, website, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoría</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Cards Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-5 w-3/4 mb-3" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Store className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-lg font-medium">No hay proveedores</p>
          <p className="text-sm">Agrega tu primer proveedor para comenzar</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {supplier.country && (
                      <span className="text-lg shrink-0">{getCountryFlag(supplier.country)}</span>
                    )}
                    <CardTitle className="text-base truncate">{supplier.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!supplier.isActive && (
                      <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-300">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <RatingStars rating={supplier.rating} />
                  <Badge variant="secondary" className="text-[10px]">
                    {CATEGORY_LABELS[supplier.category] || supplier.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {/* Contact info */}
                <div className="space-y-1 text-xs text-muted-foreground">
                  {supplier.website && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Globe className="h-3 w-3 shrink-0" />
                      <a
                        href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-emerald-600 truncate underline-offset-2 hover:underline"
                      >
                        {supplier.website}
                      </a>
                    </div>
                  )}
                  {supplier.contactEmail && (
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{supplier.contactEmail}</span>
                    </div>
                  )}
                  {supplier.contactPhone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{supplier.contactPhone}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-sm font-semibold">{supplier.totalProducts || supplier.productCount || 0}</p>
                    <p className="text-[10px] text-muted-foreground">Productos</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{supplier.totalOrders}</p>
                    <p className="text-[10px] text-muted-foreground">Órdenes</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">${supplier.totalSpentUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-muted-foreground">Gastado</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5 text-xs"
                    onClick={() => handleViewDetail(supplier)}
                  >
                    <Eye className="h-3 w-3" />
                    Ver detalles
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setEditSupplier(supplier);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    onClick={() => setDeleteConfirm(supplier.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ADD / EDIT SUPPLIER DIALOG              */}
      {/* ═══════════════════════════════════════ */}
      <SupplierFormDialog
        key={editSupplier?.id ?? 'new'}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditSupplier(null);
        }}
        supplier={editSupplier}
        onSave={handleSave}
        loading={saving}
      />

      {/* ═══════════════════════════════════════ */}
      {/* DELETE CONFIRMATION                     */}
      {/* ═══════════════════════════════════════ */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este proveedor? Los enlaces asociados también se eliminarán. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════ */}
      {/* SUPPLIER DETAIL DIALOG                  */}
      {/* ═══════════════════════════════════════ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[95vh] sm:max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailSupplier?.country && <span>{getCountryFlag(detailSupplier.country)}</span>}
              Detalle del Proveedor
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex-1 p-6 space-y-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : detailSupplier ? (
            <ScrollArea className="flex-1 min-h-0 pr-4">
              <div className="space-y-6">
                {/* Supplier info */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{detailSupplier.name}</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => handleSync(detailSupplier.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Sincronizar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs"
                        onClick={() => {
                          setEditSupplier(detailSupplier);
                          setDetailOpen(false);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <RatingStars rating={detailSupplier.rating} size="md" />
                    <Badge variant="secondary">
                      {CATEGORY_LABELS[detailSupplier.category] || detailSupplier.category}
                    </Badge>
                    {detailSupplier.lastSyncAt && (
                      <span className="text-xs text-muted-foreground">
                        Últ. sync: {new Date(detailSupplier.lastSyncAt).toLocaleDateString('es-PE')}
                      </span>
                    )}
                  </div>

                  {/* Contact details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {detailSupplier.website && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={detailSupplier.website.startsWith('http') ? detailSupplier.website : `https://${detailSupplier.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:underline truncate"
                        >
                          {detailSupplier.website}
                        </a>
                      </div>
                    )}
                    {detailSupplier.url && (
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={detailSupplier.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:underline truncate"
                        >
                          {detailSupplier.url}
                        </a>
                      </div>
                    )}
                    {detailSupplier.contactEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{detailSupplier.contactEmail}</span>
                      </div>
                    )}
                    {detailSupplier.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{detailSupplier.contactPhone}</span>
                      </div>
                    )}
                  </div>

                  {detailSupplier.notes && (
                    <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                      {detailSupplier.notes}
                    </p>
                  )}

                  {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center rounded-lg border p-3 bg-muted/20">
                    <div>
                      <p className="text-lg font-bold">{detailSupplier.totalProducts}</p>
                      <p className="text-xs text-muted-foreground">Productos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{detailSupplier.totalOrders}</p>
                      <p className="text-xs text-muted-foreground">Órdenes</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">${detailSupplier.totalSpentUsd.toLocaleString('en-US', { minimumFractionDigits: 0 })}</p>
                      <p className="text-xs text-muted-foreground">Total Gastado</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Links Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Enlaces ({detailSupplier.links.length})
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => setLinkFormOpen(true)}
                    >
                      <Plus className="h-3 w-3" />
                      Agregar Enlace
                    </Button>
                  </div>

                  {detailSupplier.links.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay enlaces registrados
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {detailSupplier.links.map((link) => {
                        const typeConfig = LINK_TYPE_CONFIG[link.type] || LINK_TYPE_CONFIG.url;
                        const statusConfig = LINK_STATUS_LABELS[link.status] || LINK_STATUS_LABELS.active;
                        const TypeIcon = typeConfig.icon;
                        return (
                          <div key={link.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/20">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-md ${typeConfig.color}`}>
                              <TypeIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{link.title}</p>
                              {link.url && link.type === 'url' && (
                                <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                              )}
                              {link.notes && (
                                <p className="text-xs text-muted-foreground truncate">{link.notes}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {link.priceUsd > 0 && (
                                <span className="text-xs font-medium text-emerald-600">${link.priceUsd.toFixed(2)}</span>
                              )}
                              <Badge variant="outline" className={`text-[10px] ${statusConfig.color}`}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Products Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Productos asociados ({detailSupplier.products.length})
                  </h4>

                  {detailSupplier.products.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay productos asociados a este proveedor
                    </p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Grado</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Compra</TableHead>
                            <TableHead className="text-right">Venta</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detailSupplier.products.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium max-w-[200px] truncate">
                                {product.description}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {product.grade}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {product.shippingStatus}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                ${product.purchasePriceUsd.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                S/ {product.salePricePen.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════ */}
      {/* ADD LINK DIALOG                         */}
      {/* ═══════════════════════════════════════ */}
      <LinkFormDialog
        key={linkFormOpen ? 'open' : 'closed'}
        open={linkFormOpen}
        onOpenChange={setLinkFormOpen}
        onSave={handleAddLink}
        loading={linkSaving}
      />

      {/* ═══════════════════════════════════════ */}
      {/* EBAY CONNECT DIALOG                     */}
      {/* ═══════════════════════════════════════ */}
      <Dialog open={ebayDialogOpen} onOpenChange={setEbayDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-orange-600" />
              Conectar cuenta eBay
            </DialogTitle>
            <DialogDescription>
              Conecta tu cuenta de eBay para ver tu historial de compras, calificaciones y más.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
              <h4 className="text-sm font-semibold">¿Cómo funciona?</h4>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Configura tus API keys de eBay en el archivo <code className="bg-muted px-1 rounded">.env</code> (<code className="bg-muted px-1 rounded">EBAY_APP_ID</code> y <code className="bg-muted px-1 rounded">EBAY_CERT_ID</code>)</li>
                <li>Registra tu aplicación en el eBay Developer Program</li>
                <li>Habilita el OAuth de eBay para autorizar el acceso a tu cuenta</li>
                <li>Una vez conectado, podrás ver tus compras y calificaciones</li>
              </ol>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900">
              <span className="text-sm">⚠️</span>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                Esta función requiere configuración adicional del servidor. Contacta al administrador si necesitas habilitarla.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEbayDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────
// SUPPLIER FORM DIALOG
// ─────────────────────────────────────────────────
function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSave,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  onSave: (data: SupplierFormData) => void;
  loading: boolean;
}) {
  const getInitialForm = (s: Supplier | null): SupplierFormData =>
    s
      ? {
          name: s.name,
          website: s.website,
          url: s.url,
          contactEmail: s.contactEmail,
          contactPhone: s.contactPhone,
          country: s.country,
          notes: s.notes,
          category: s.category,
          rating: s.rating,
          isActive: s.isActive,
        }
      : {
          name: '',
          website: '',
          url: '',
          contactEmail: '',
          contactPhone: '',
          country: '',
          notes: '',
          category: 'general',
          rating: 0,
          isActive: true,
        };

  const [form, setForm] = useState<SupplierFormData>(() => getInitialForm(supplier));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[95vh] sm:max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</DialogTitle>
          <DialogDescription>
            {supplier ? 'Actualiza los datos del proveedor' : 'Completa los datos del nuevo proveedor'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nombre del proveedor"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://ejemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL Perfil</Label>
              <Input
                id="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="URL tienda eBay, AliExpress..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email de Contacto</Label>
              <Input
                id="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                placeholder="contacto@proveedor.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Teléfono</Label>
              <Input
                id="contactPhone"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                placeholder="+1 234 567 890"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>País</Label>
              <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as SupplierCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Calificación</Label>
            <RatingStars
              rating={form.rating || 0}
              onRate={(r) => setForm({ ...form, rating: r })}
              size="md"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notas sobre el proveedor..."
              rows={3}
            />
          </div>
        </form>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !form.name.trim()}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            type="button"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {supplier ? 'Actualizar' : 'Crear Proveedor'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────
// LINK FORM DIALOG
// ─────────────────────────────────────────────────
function LinkFormDialog({
  open,
  onOpenChange,
  onSave,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: SupplierLinkFormData) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<SupplierLinkFormData>({
    title: '',
    url: '',
    type: 'url',
    priceUsd: 0,
    pricePen: 0,
    status: 'active',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Enlace</DialogTitle>
          <DialogDescription>
            Agrega un nuevo enlace al proveedor
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkTitle">Título *</Label>
            <Input
              id="linkTitle"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Nombre del enlace"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkUrl">URL</Label>
            <Input
              id="linkUrl"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as SupplierLinkType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LINK_TYPE_CONFIG).map(([val, config]) => (
                    <SelectItem key={val} value={val}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as SupplierLinkStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(LINK_STATUS_LABELS).map(([val, config]) => (
                    <SelectItem key={val} value={val}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priceUsd">Precio USD</Label>
              <Input
                id="priceUsd"
                type="number"
                step="0.01"
                min="0"
                value={form.priceUsd || ''}
                onChange={(e) => setForm({ ...form, priceUsd: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pricePen">Precio PEN</Label>
              <Input
                id="pricePen"
                type="number"
                step="0.01"
                min="0"
                value={form.pricePen || ''}
                onChange={(e) => setForm({ ...form, pricePen: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkNotes">Notas</Label>
            <Textarea
              id="linkNotes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notas sobre el enlace..."
              rows={2}
            />
          </div>
        </form>
        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !form.title.trim()}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            type="button"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Agregar Enlace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
