'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, ShoppingBag, Loader2, ExternalLink, DollarSign } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { fetchProducts, deleteProduct, createProduct, updateProduct } from '@/lib/api';
import type { Product, ProductFormData } from '@/lib/types';
import { ProductDialog } from './product-dialog';
import { useToast } from '@/hooks/use-toast';

// ── eBay Types ──
interface EbaySearchItem {
  itemId: string;
  title: string;
  price: { value: string; currency: string };
  image: string;
  condition: string;
  shippingCost: string;
  itemWebUrl: string;
  seller: {
    username: string;
    feedbackScore: number;
    feedbackPercentage: string;
  };
}

// ── Helpers ──
function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusStyles: Record<string, string> = {
  USA: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'En Tránsito': 'bg-sky-100 text-sky-800 border-sky-300',
  Perú: 'bg-purple-100 text-purple-800 border-purple-300',
  Entregado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

const gradeStyles: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  B: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  C: 'bg-red-100 text-red-800 border-red-300',
};

// ── eBay Category Options ──
const EBAY_CATEGORIES = [
  { id: '6000', label: 'iPads' },
  { id: '111422', label: 'MacBooks' },
  { id: '9355', label: 'iPhones' },
  { id: '178893', label: 'Smartwatches' },
  { id: '112532', label: 'AirPods / Accesorios' },
];

// ── eBay Sort Options ──
const EBAY_SORT_OPTIONS = [
  { value: 'price', label: 'Precio menor' },
  { value: 'price+desc', label: 'Precio mayor' },
  { value: 'relevance', label: 'Mejor match' },
  { value: 'newlyListed', label: 'Más recientes' },
];

export function ProductosTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);

  // ── eBay Search State ──
  const [ebayDialogOpen, setEbayDialogOpen] = useState(false);
  const [ebayQuery, setEbayQuery] = useState('');
  const [ebayCategory, setEbayCategory] = useState('');
  const [ebaySort, setEbaySort] = useState('price');
  const [ebaySearching, setEbaySearching] = useState(false);
  const [ebayResults, setEbayResults] = useState<EbaySearchItem[]>([]);
  const [ebayImporting, setEbayImporting] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProducts({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined,
        grade: gradeFilter !== 'all' ? gradeFilter : undefined,
      });
      setProducts(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los productos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, gradeFilter, toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSave = async (data: ProductFormData) => {
    try {
      setSaving(true);
      if (editProduct) {
        await updateProduct(editProduct.id, data);
        toast({ title: 'Producto actualizado', description: 'Los cambios se guardaron correctamente.' });
      } else {
        await createProduct(data);
        toast({ title: 'Producto creado', description: 'El producto se agregó correctamente.' });
      }
      setDialogOpen(false);
      setEditProduct(null);
      await loadProducts();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el producto', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      toast({ title: 'Producto eliminado', description: 'El producto se eliminó correctamente.' });
      setDeleteConfirm(null);
      await loadProducts();
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar el producto', variant: 'destructive' });
    }
  };

  // ── eBay Search Handler ──
  const handleEbaySearch = async () => {
    if (!ebayQuery.trim()) {
      toast({ title: 'Campo requerido', description: 'Ingresa un término de búsqueda', variant: 'destructive' });
      return;
    }

    try {
      setEbaySearching(true);
      setEbayResults([]);

      const params = new URLSearchParams();
      params.set('q', ebayQuery.trim());
      if (ebayCategory) params.set('category_id', ebayCategory);
      if (ebaySort) params.set('sort', ebaySort);
      params.set('limit', '20');

      const response = await fetch(`/api/ebay/search?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en la búsqueda');
      }

      setEbayResults(data.items || []);
      if (data.items?.length === 0) {
        toast({ title: 'Sin resultados', description: 'No se encontraron productos en eBay' });
      }
    } catch (error) {
      console.error('eBay search error:', error);
      toast({
        title: 'Error en eBay',
        description: error instanceof Error ? error.message : 'No se pudo conectar con eBay',
        variant: 'destructive',
      });
    } finally {
      setEbaySearching(false);
    }
  };

  // ── eBay Import Handler ──
  const handleEbayImport = async (item: EbaySearchItem) => {
    try {
      setEbayImporting(item.itemId);
      toast({ title: 'Importando...', description: `Importando ${item.title}` });

      const productData: ProductFormData = {
        description: item.title,
        category: guessCategory(ebayCategory),
        grade: 'A',
        condition: item.condition || 'Used',
        status: 'USA',
        supplier: 'eBay',
        courier: '',
        trackingNumber: '',
        estimatedArrival: '',
        screenOk: false,
        touchOk: false,
        speakersOk: false,
        microphoneOk: false,
        wifiOk: false,
        bluetoothOk: false,
        camerasOk: false,
        portsOk: false,
        buttonsOk: false,
        keyboardOk: false,
        trackpadOk: false,
        chassisOk: false,
        batteryOk: false,
        chargerIncluded: false,
        originalBox: false,
        batteryCycles: null,
        purchasePriceUSD: parseFloat(item.price.value) || 0,
        shippingCostUSD: parseFloat(item.shippingCost) || 0,
        advertisingCostUSD: 0,
        extraCostsUSD: 0,
        exchangeRate: 3.7,
        salePricePEN: 0,
      };

      await createProduct(productData);
      toast({ title: 'Producto importado', description: `"${item.title}" se agregó al inventario.` });
      await loadProducts();
    } catch (error) {
      console.error('eBay import error:', error);
      toast({
        title: 'Error al importar',
        description: error instanceof Error ? error.message : 'No se pudo importar el producto',
        variant: 'destructive',
      });
    } finally {
      setEbayImporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Productos</h2>
          <p className="text-muted-foreground">Gestión de inventario de importación</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setEbayDialogOpen(true)}
            variant="outline"
            className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
          >
            <ShoppingBag className="h-4 w-4" />
            Buscar en eBay
          </Button>
          <Button
            onClick={() => {
              setEditProduct(null);
              setDialogOpen(true);
            }}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descripción, proveedor, tracking..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Estado</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="USA">USA</SelectItem>
                  <SelectItem value="En Tránsito">En Tránsito</SelectItem>
                  <SelectItem value="Perú">Perú</SelectItem>
                  <SelectItem value="Entregado">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Grado</label>
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="A">Grado A</SelectItem>
                  <SelectItem value="B">Grado B</SelectItem>
                  <SelectItem value="C">Grado C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No hay productos</p>
              <p className="text-sm">Agrega tu primer producto para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Grado</TableHead>
                    <TableHead className="text-right">Precio Compra</TableHead>
                    <TableHead className="text-right">Precio Venta</TableHead>
                    <TableHead className="text-right">Ganancia</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={p.description}>
                        {p.description}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusStyles[p.status] || ''}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={gradeStyles[p.grade] || ''}>Grado {p.grade}</Badge>
                      </TableCell>
                      <TableCell className="text-right">${p.purchasePriceUSD.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatPEN(p.salePricePEN)}</TableCell>
                      <TableCell className={`text-right font-medium ${p.profitPEN >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatPEN(p.profitPEN)}
                      </TableCell>
                      <TableCell className="text-sm">{p.courier}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewProduct(p)} title="Ver">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditProduct(p);
                            setDialogOpen(true);
                          }} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm(p.id)} title="Eliminar">
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

      {/* Product Dialog */}
      <ProductDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditProduct(null);
        }}
        product={editProduct}
        onSave={handleSave}
        loading={saving}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Product Dialog */}
      <Dialog open={!!viewProduct} onOpenChange={() => setViewProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del Producto</DialogTitle>
          </DialogHeader>
          {viewProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Orden:</span> <span className="font-medium">{viewProduct.orderNumber}</span></div>
                <div><span className="text-muted-foreground">Categoría:</span> <span className="font-medium">{viewProduct.category}</span></div>
                <div><span className="text-muted-foreground">Grado:</span> <Badge variant="outline" className={gradeStyles[viewProduct.grade]}>{viewProduct.grade}</Badge></div>
                <div><span className="text-muted-foreground">Estado:</span> <Badge variant="outline" className={statusStyles[viewProduct.status]}>{viewProduct.status}</Badge></div>
                <div><span className="text-muted-foreground">Proveedor:</span> <span className="font-medium">{viewProduct.supplier}</span></div>
                <div><span className="text-muted-foreground">Courier:</span> <span className="font-medium">{viewProduct.courier}</span></div>
                <div><span className="text-muted-foreground">Tracking:</span> <span className="font-medium">{viewProduct.trackingNumber}</span></div>
                <div><span className="text-muted-foreground">Condición:</span> <span className="font-medium">{viewProduct.condition}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm rounded-lg border p-4 bg-muted/30">
                <div><span className="text-muted-foreground">Precio Compra:</span> <span className="font-medium">${viewProduct.purchasePriceUSD.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Precio Venta:</span> <span className="font-medium">{formatPEN(viewProduct.salePricePEN)}</span></div>
                <div><span className="text-muted-foreground">Costo Total:</span> <span className="font-medium">{formatPEN(viewProduct.totalCostPEN)}</span></div>
                <div><span className="text-muted-foreground">Ganancia:</span> <span className={`font-medium ${viewProduct.profitPEN >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatPEN(viewProduct.profitPEN)}</span></div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Descripción:</span>
                <p className="text-sm font-medium mt-1">{viewProduct.description}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* eBay Search Dialog                                          */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Dialog open={ebayDialogOpen} onOpenChange={setEbayDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-orange-600" />
              Buscar en eBay
            </DialogTitle>
            <DialogDescription>
              Busca productos en eBay para importar a tu inventario
            </DialogDescription>
          </DialogHeader>

          {/* Search Controls */}
          <div className="space-y-4 border-b pb-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar iPhone, iPad, MacBook..."
                  value={ebayQuery}
                  onChange={(e) => setEbayQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEbaySearch()}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={handleEbaySearch}
                disabled={ebaySearching}
                className="gap-2 bg-orange-600 hover:bg-orange-700 text-white shrink-0"
              >
                {ebaySearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </Button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="space-y-1 sm:w-[200px]">
                <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                <Select value={ebayCategory} onValueChange={setEbayCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas</SelectItem>
                    {EBAY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:w-[180px]">
                <label className="text-xs font-medium text-muted-foreground">Ordenar por</label>
                <Select value={ebaySort} onValueChange={setEbaySort}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EBAY_SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Results */}
          <ScrollArea className="flex-1 min-h-0">
            {ebaySearching ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-sm text-muted-foreground">Buscando en eBay...</p>
              </div>
            ) : ebayResults.length === 0 && !ebaySearching ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Busca productos en eBay</p>
                <p className="text-sm">Ingresa un término y haz clic en &quot;Buscar&quot;</p>
              </div>
            ) : (
              <div className="space-y-3 pr-3">
                <p className="text-sm text-muted-foreground">
                  {ebayResults.length} resultado{ebayResults.length !== 1 ? 's' : ''} encontrado{ebayResults.length !== 1 ? 's' : ''}
                </p>
                {ebayResults.map((item) => (
                  <Card key={item.itemId} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Image */}
                        <div className="w-24 h-24 bg-muted rounded-md flex-shrink-0 overflow-hidden">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium line-clamp-2 mb-1.5">
                            {item.title}
                          </h4>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <DollarSign className="h-3 w-3" />
                              {parseFloat(item.price.value).toLocaleString('en-US', {
                                style: 'currency',
                                currency: item.price.currency,
                                minimumFractionDigits: 2,
                              })}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {item.condition}
                            </Badge>
                            {parseFloat(item.shippingCost) > 0 && (
                              <Badge variant="outline" className="text-xs">
                                +{parseFloat(item.shippingCost).toLocaleString('en-US', {
                                  style: 'currency',
                                  currency: item.price.currency,
                                })} envío
                              </Badge>
                            )}
                            {parseFloat(item.shippingCost) === 0 && (
                              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                                Envío gratis
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>{item.seller.username}</span>
                            <span>•</span>
                            <span>{item.seller.feedbackPercentage} positivo</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleEbayImport(item)}
                            disabled={ebayImporting === item.itemId}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-xs text-white"
                          >
                            {ebayImporting === item.itemId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ShoppingBag className="h-3 w-3" />
                            )}
                            Importar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs"
                            asChild
                          >
                            <a href={item.itemWebUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                              Ver en eBay
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Utility: Guess product category from eBay category ID ──
function guessCategory(ebayCategoryId: string): ProductFormData['category'] {
  const map: Record<string, ProductFormData['category']> = {
    '6000': 'iPad',
    '111422': 'Laptop',
    '9355': 'iPhone',
    '178893': 'Smartwatch',
    '112532': 'Accesorio',
  };
  return map[ebayCategoryId] || 'Otro';
}

// Simple inline package icon for empty state
function Package({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/>
    </svg>
  );
}
