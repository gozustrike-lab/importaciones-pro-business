'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Search, MapPin } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fetchProducts, fetchTracking } from '@/lib/api';
import type { Product, TrackingUpdate } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const statusStyles: Record<string, string> = {
  USA: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  'En Tránsito': 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
  Perú: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  Entregado: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
};

export function TrackingTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTracking, setSearchTracking] = useState('');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<Record<string, TrackingUpdate[]>>({});

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchProducts({ status: 'En Tránsito' });
      setProducts(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los productos en tránsito', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const loadTracking = async (productId: string) => {
    if (trackingData[productId]) {
      setExpandedProduct(expandedProduct === productId ? null : productId);
      return;
    }
    try {
      const data = await fetchTracking(productId);
      setTrackingData((prev) => ({ ...prev, [productId]: data }));
      setExpandedProduct(productId);
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el tracking', variant: 'destructive' });
    }
  };

  // Filter products by search
  const filteredProducts = products.filter(
    (p) =>
      !searchTracking.trim() ||
      p.trackingNumber.toLowerCase().includes(searchTracking.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTracking.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tracking</h2>
        <p className="text-muted-foreground">Seguimiento de envíos en tránsito</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por tracking o descripción..."
              value={searchTracking}
              onChange={(e) => setSearchTracking(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Product Tracking Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Truck className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">Sin envíos en tránsito</p>
            <p className="text-sm">No hay productos con estado &quot;En Tránsito&quot;</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredProducts.map((product) => {
            const updates = trackingData[product.id] || [];
            const isExpanded = expandedProduct === product.id;

            return (
              <Card key={product.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <CardTitle className="text-sm truncate">{product.description}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span className="font-mono text-xs">{product.trackingNumber || 'Sin tracking'}</span>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant="outline" className={statusStyles[product.status] || ''}>
                        {product.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{product.courier}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => loadTracking(product.id)}
                  >
                    <Truck className="h-4 w-4 mr-2" />
                    {isExpanded ? 'Ocultar Tracking' : 'Ver Tracking'}
                  </Button>

                  {/* Timeline */}
                  {isExpanded && (
                    <div className="mt-4 pl-4">
                      {updates.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Sin actualizaciones de tracking
                        </p>
                      ) : (
                        <div className="relative space-y-0">
                          {/* Timeline line */}
                          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border" />

                          {updates.map((update, idx) => {
                            const isFirst = idx === 0;
                            const isLast = idx === updates.length - 1;

                            return (
                              <div key={update.id} className="relative flex gap-4 pb-4 last:pb-0">
                                {/* Dot */}
                                <div className="relative z-10 mt-1">
                                  <div
                                    className={`h-3.5 w-3.5 rounded-full border-2 ${
                                      isFirst
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : isLast
                                        ? 'bg-muted-foreground/30 border-muted-foreground/40'
                                        : 'bg-background border-muted-foreground/40'
                                    }`}
                                  />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(update.date).toLocaleDateString('es-PE', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </span>
                                    <Badge variant="secondary" className="text-xs h-5">
                                      {update.status}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-medium mt-0.5">{update.description}</p>
                                  {update.location && (
                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                      <MapPin className="h-3 w-3" />
                                      {update.location}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
