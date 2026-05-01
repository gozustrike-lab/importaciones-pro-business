'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MapPin,
  Mail,
  Star,
  Eye,
  Pencil,
  Trash2,
  ShoppingBag,
  X,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchClients, fetchClient, createClient, updateClient, deleteClient } from '@/lib/api';
import type { Client, ClientFormData, Sale } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ClientesTab() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<(Client & { sales: Sale[] }) | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchClients({ search: search || undefined });
      setClients(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los clientes', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleSave = async (data: ClientFormData) => {
    try {
      setSaving(true);
      if (editClient) {
        await updateClient(editClient.id, data);
        toast({ title: 'Cliente actualizado', description: 'Los datos se guardaron correctamente.' });
      } else {
        await createClient(data);
        toast({ title: 'Cliente creado', description: 'El cliente se agregó correctamente.' });
      }
      setDialogOpen(false);
      setEditClient(null);
      await loadClients();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el cliente', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClient(id);
      toast({ title: 'Cliente eliminado', description: 'El cliente se eliminó correctamente.' });
      setDeleteConfirm(null);
      await loadClients();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el cliente';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleViewClient = async (id: string) => {
    try {
      setLoadingDetail(true);
      const data = await fetchClient(id);
      setSelectedClient(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el detalle del cliente', variant: 'destructive' });
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">CRM - Clientes</h2>
          <p className="text-muted-foreground">Gestión de clientes y base de datos</p>
        </div>
        <Button
          onClick={() => { setEditClient(null); setDialogOpen(true); }}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo Cliente
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clients.length}</p>
                <p className="text-xs text-muted-foreground">Total Clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clients.filter(c => c.isFrequent).length}</p>
                <p className="text-xs text-muted-foreground">Clientes Frecuentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-100 p-2">
                <ShoppingBag className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clients.reduce((sum, c) => sum + c.totalPurchases, 0)}</p>
                <p className="text-xs text-muted-foreground">Total Compras</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, DNI/RUC, celular..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No hay clientes</p>
              <p className="text-sm">Agrega tu primer cliente para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>DNI/RUC</TableHead>
                    <TableHead>Celular</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead className="text-center">Compras</TableHead>
                    <TableHead className="text-right">Total Gastado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.fullName}</span>
                          {c.isFrequent && (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-1.5">
                              <Star className="h-3 w-3 mr-0.5" /> VIP
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.dniRuc || '-'}</TableCell>
                      <TableCell className="text-sm">{c.celular || '-'}</TableCell>
                      <TableCell className="text-sm">{c.ciudad || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-mono">{c.totalPurchases}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-emerald-600">
                        {formatPEN(c.totalSpent)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewClient(c.id)} title="Ver detalle">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditClient(c); setDialogOpen(true); }} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm(c.id)} title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Form Dialog */}
      <ClientFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditClient(null); }}
        client={editClient}
        onSave={handleSave}
        loading={saving}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>¿Estás seguro de que deseas eliminar este cliente? Solo se pueden eliminar clientes sin ventas registradas.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Detail Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Ficha del Cliente
              {selectedClient?.isFrequent && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-300">
                  <Star className="h-3 w-3 mr-1" /> Cliente Frecuente
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : selectedClient ? (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Nombre:</span>
                  <span className="font-medium">{selectedClient.fullName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">DNI/RUC:</span>
                  <span className="font-medium">{selectedClient.dniRuc || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Celular:</span>
                  <span className="font-medium">{selectedClient.celular || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{selectedClient.email || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Ciudad:</span>
                  <span className="font-medium">{selectedClient.ciudad || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Dirección:</span>
                  <span className="font-medium text-xs">{selectedClient.direccion || '-'}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{selectedClient.totalPurchases}</p>
                  <p className="text-xs text-muted-foreground">Compras Realizadas</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{formatPEN(selectedClient.totalSpent)}</p>
                  <p className="text-xs text-muted-foreground">Total Gastado</p>
                </div>
              </div>

              {selectedClient.notas && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Notas:</p>
                  <p className="text-sm">{selectedClient.notas}</p>
                </div>
              )}

              {/* Purchase History */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Historial de Compras</h3>
                {selectedClient.sales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay compras registradas</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Canal</TableHead>
                          <TableHead className="text-right">Precio</TableHead>
                          <TableHead className="text-right">Ganancia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedClient.sales.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="text-sm">
                              {new Date(s.saleDate).toLocaleDateString('es-PE')}
                            </TableCell>
                            <TableCell className="font-medium text-sm max-w-[200px] truncate">
                              {s.productDescription}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{s.saleChannel || '-'}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatPEN(s.salePricePen)}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${s.netProfitPen >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatPEN(s.netProfitPen)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Client Form Dialog Component
function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSave,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onSave: (data: ClientFormData) => void;
  loading: boolean;
}) {
  const defaultForm: ClientFormData = { fullName: '', dniRuc: '', celular: '', email: '', ciudad: '', direccion: '', notas: '' };
  const [formData, setFormData] = useState<ClientFormData>(defaultForm);
  const [initialized, setInitialized] = useState(false);

  // Sync form data when dialog opens with a client
  if (open && !initialized) {
    if (client) {
      setFormData({
        fullName: client.fullName,
        dniRuc: client.dniRuc,
        celular: client.celular,
        email: client.email,
        ciudad: client.ciudad,
        direccion: client.direccion,
        notas: client.notas,
      });
    } else {
      setFormData(defaultForm);
    }
    setInitialized(true);
  }

  // Reset when dialog closes
  if (!open && initialized) {
    setInitialized(false);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) return;
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          <DialogDescription>
            {client ? 'Modifica los datos del cliente' : 'Completa los datos para registrar un nuevo cliente'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nombre Completo *</Label>
            <Input id="fullName" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="Juan Pérez López" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dniRuc">DNI / RUC</Label>
              <Input id="dniRuc" value={formData.dniRuc} onChange={(e) => setFormData({ ...formData, dniRuc: e.target.value })} placeholder="12345678" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="celular">Celular</Label>
              <Input id="celular" value={formData.celular} onChange={(e) => setFormData({ ...formData, celular: e.target.value })} placeholder="987 654 321" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="cliente@email.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input id="ciudad" value={formData.ciudad} onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })} placeholder="Lima" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} placeholder="Av. Principal 123" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" value={formData.notas} onChange={(e) => setFormData({ ...formData, notas: e.target.value })} placeholder="Notas adicionales sobre el cliente..." rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading || !formData.fullName.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              {loading ? 'Guardando...' : client ? 'Actualizar' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
