'use client';

import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Search } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
import { fetchProducts, fetchQualityChecks, createQualityCheck } from '@/lib/api';
import type { Product, QualityCheck } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface CheckState {
  screenOk: boolean;
  touchOk: boolean;
  speakersOk: boolean;
  microphoneOk: boolean;
  wifiOk: boolean;
  bluetoothOk: boolean;
  camerasOk: boolean;
  portsOk: boolean;
  buttonsOk: boolean;
  keyboardOk: boolean;
  trackpadOk: boolean;
  chassisOk: boolean;
  batteryOk: boolean;
  chargerIncluded: boolean;
  originalBox: boolean;
}

const defaultChecks: CheckState = {
  screenOk: true,
  touchOk: true,
  speakersOk: true,
  microphoneOk: true,
  wifiOk: true,
  bluetoothOk: true,
  camerasOk: true,
  portsOk: true,
  buttonsOk: true,
  keyboardOk: true,
  trackpadOk: true,
  chassisOk: true,
  batteryOk: true,
  chargerIncluded: false,
  originalBox: false,
};

const checkLabels: Record<keyof CheckState, string> = {
  screenOk: 'Pantalla OK',
  touchOk: 'Touch OK',
  speakersOk: 'Altavoces OK',
  microphoneOk: 'Micrófono OK',
  wifiOk: 'WiFi OK',
  bluetoothOk: 'Bluetooth OK',
  camerasOk: 'Cámaras OK',
  portsOk: 'Puertos OK',
  buttonsOk: 'Botones OK',
  keyboardOk: 'Teclado OK',
  trackpadOk: 'Trackpad OK',
  chassisOk: 'Carcasa OK',
  batteryOk: 'Batería OK',
  chargerIncluded: 'Cargador Incluido',
  originalBox: 'Caja Original',
};

export function CalidadTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [checks, setChecks] = useState<CheckState>(defaultChecks);
  const [inspector, setInspector] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qualityHistory, setQualityHistory] = useState<QualityCheck[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadProducts = useCallback(async () => {
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const loadHistory = useCallback(async (productId: string) => {
    if (!productId) return;
    try {
      setLoadingHistory(true);
      const data = await fetchQualityChecks(productId);
      setQualityHistory(data);
    } catch {
      setQualityHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      loadHistory(selectedProduct);
    } else {
      setQualityHistory([]);
    }
  }, [selectedProduct, loadHistory]);

  const toggleCheck = (key: keyof CheckState) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!selectedProduct) {
      toast({ title: 'Error', description: 'Selecciona un producto primero', variant: 'destructive' });
      return;
    }
    if (!inspector.trim()) {
      toast({ title: 'Error', description: 'Ingresa el nombre del inspector', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);
      await createQualityCheck(selectedProduct, {
        inspectorName: inspector,
        notes,
        checks: { ...checks },
      });
      toast({ title: 'Inspección guardada', description: 'La revisión de calidad se registró correctamente.' });
      setChecks(defaultChecks);
      setNotes('');
      await loadHistory(selectedProduct);
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la inspección', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const passedCount = Object.values(checks).filter(Boolean).length;
  const totalCount = Object.keys(checks).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Control de Calidad</h2>
        <p className="text-muted-foreground">Inspección de calidad de productos importados</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Product Selector + Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">Nueva Inspección</CardTitle>
            </div>
            <CardDescription>Selecciona un producto y realiza la revisión</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Product selector */}
            <div className="space-y-2">
              <Label>Seleccionar Producto</Label>
              <Select value={selectedProduct} onValueChange={(v) => {
                setSelectedProduct(v);
                setChecks(defaultChecks);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Buscar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.description.substring(0, 50)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct && (
              <>
                {/* Pantalla */}
                <CheckSection title="Pantalla">
                  <CheckItem label={checkLabels.screenOk} checked={checks.screenOk} onChange={() => toggleCheck('screenOk')} />
                  <CheckItem label={checkLabels.touchOk} checked={checks.touchOk} onChange={() => toggleCheck('touchOk')} />
                </CheckSection>

                {/* Audio */}
                <CheckSection title="Audio">
                  <CheckItem label={checkLabels.speakersOk} checked={checks.speakersOk} onChange={() => toggleCheck('speakersOk')} />
                  <CheckItem label={checkLabels.microphoneOk} checked={checks.microphoneOk} onChange={() => toggleCheck('microphoneOk')} />
                </CheckSection>

                {/* Conectividad */}
                <CheckSection title="Conectividad">
                  <CheckItem label={checkLabels.wifiOk} checked={checks.wifiOk} onChange={() => toggleCheck('wifiOk')} />
                  <CheckItem label={checkLabels.bluetoothOk} checked={checks.bluetoothOk} onChange={() => toggleCheck('bluetoothOk')} />
                </CheckSection>

                {/* Hardware */}
                <CheckSection title="Hardware">
                  <CheckItem label={checkLabels.camerasOk} checked={checks.camerasOk} onChange={() => toggleCheck('camerasOk')} />
                  <CheckItem label={checkLabels.portsOk} checked={checks.portsOk} onChange={() => toggleCheck('portsOk')} />
                  <CheckItem label={checkLabels.buttonsOk} checked={checks.buttonsOk} onChange={() => toggleCheck('buttonsOk')} />
                </CheckSection>

                {/* Para Laptops */}
                <CheckSection title="Para Laptops">
                  <CheckItem label={checkLabels.keyboardOk} checked={checks.keyboardOk} onChange={() => toggleCheck('keyboardOk')} />
                  <CheckItem label={checkLabels.trackpadOk} checked={checks.trackpadOk} onChange={() => toggleCheck('trackpadOk')} />
                </CheckSection>

                {/* General */}
                <CheckSection title="General">
                  <CheckItem label={checkLabels.chassisOk} checked={checks.chassisOk} onChange={() => toggleCheck('chassisOk')} />
                  <CheckItem label={checkLabels.batteryOk} checked={checks.batteryOk} onChange={() => toggleCheck('batteryOk')} />
                  <CheckItem label={checkLabels.chargerIncluded} checked={checks.chargerIncluded} onChange={() => toggleCheck('chargerIncluded')} />
                  <CheckItem label={checkLabels.originalBox} checked={checks.originalBox} onChange={() => toggleCheck('originalBox')} />
                </CheckSection>

                <Separator />

                {/* Score */}
                <div className="rounded-lg border bg-muted/30 p-4 text-center">
                  <span className="text-sm text-muted-foreground">Puntuación: </span>
                  <span className={`text-lg font-bold ${passedCount === totalCount ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {passedCount}/{totalCount}
                  </span>
                  <span className="text-sm text-muted-foreground"> pruebas aprobadas</span>
                </div>

                {/* Inspector */}
                <div className="space-y-2">
                  <Label>Nombre del Inspector</Label>
                  <Input
                    placeholder="Ej: Juan Pérez"
                    value={inspector}
                    onChange={(e) => setInspector(e.target.value)}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    placeholder="Observaciones adicionales..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? 'Guardando...' : 'Guardar Inspección'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quality History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de Inspecciones</CardTitle>
            <CardDescription>
              {selectedProduct ? 'Inspecciones del producto seleccionado' : 'Selecciona un producto para ver su historial'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHistory ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : qualityHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mb-4 opacity-40" />
                <p className="text-sm">Sin inspecciones registradas</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {qualityHistory.map((qc) => {
                  const passed = Object.values(qc.checks).filter(Boolean).length;
                  const total = Object.keys(qc.checks).length;
                  const allPassed = passed === total;
                  return (
                    <div key={qc.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{qc.inspectorName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(qc.createdAt).toLocaleDateString('es-PE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <Badge variant="outline" className={allPassed ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'}>
                          {allPassed ? '✓ Aprobado' : '⚠ Parcial'}
                        </Badge>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Resultado:</span>{' '}
                        <span className="font-medium">{passed}/{total}</span> pruebas aprobadas
                      </div>
                      {qc.notes && (
                        <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">{qc.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CheckSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function CheckItem({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label className="text-sm cursor-pointer" onClick={onChange}>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
