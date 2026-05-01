'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { Product, ProductFormData, ProductStatus, ProductGrade, ProductCategory } from '@/lib/types';

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
  onSave: (data: ProductFormData) => void;
  loading?: boolean;
}

const defaultForm: ProductFormData = {
  orderNumber: '',
  description: '',
  category: 'Smartphone',
  grade: 'A',
  condition: 'Nuevo',
  status: 'USA',
  supplier: '',
  courier: '',
  trackingNumber: '',
  estimatedArrival: '',
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
  batteryCycles: null,
  purchasePriceUSD: 0,
  shippingCostUSD: 0,
  advertisingCostUSD: 0,
  extraCostsUSD: 0,
  exchangeRate: 3.72,
  salePricePEN: 0,
};

export function ProductDialog({ open, onOpenChange, product, onSave, loading }: ProductDialogProps) {
  const [form, setForm] = useState<ProductFormData>(defaultForm);

  const productForm = useMemo<ProductFormData>(() => {
    if (!product) return defaultForm;
    return {
      orderNumber: product.orderNumber,
      description: product.description,
      category: product.category,
      grade: product.grade,
      condition: product.condition,
      status: product.status,
      supplier: product.supplier,
      courier: product.courier,
      trackingNumber: product.trackingNumber,
      estimatedArrival: product.estimatedArrival,
      screenOk: product.screenOk,
      touchOk: product.touchOk,
      speakersOk: product.speakersOk,
      microphoneOk: product.microphoneOk,
      wifiOk: product.wifiOk,
      bluetoothOk: product.bluetoothOk,
      camerasOk: product.camerasOk,
      portsOk: product.portsOk,
      buttonsOk: product.buttonsOk,
      keyboardOk: product.keyboardOk,
      trackpadOk: product.trackpadOk,
      chassisOk: product.chassisOk,
      batteryOk: product.batteryOk,
      chargerIncluded: product.chargerIncluded,
      originalBox: product.originalBox,
      batteryCycles: product.batteryCycles,
      purchasePriceUSD: product.purchasePriceUSD,
      shippingCostUSD: product.shippingCostUSD,
      advertisingCostUSD: product.advertisingCostUSD,
      extraCostsUSD: product.extraCostsUSD,
      exchangeRate: product.exchangeRate,
      salePricePEN: product.salePricePEN,
    };
  }, [product]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setForm(product ? { ...productForm } : { ...defaultForm });
    }
    onOpenChange(newOpen);
  }, [product, productForm, onOpenChange]);

  const totalCostUSD = useMemo(
    () =>
      form.purchasePriceUSD + form.shippingCostUSD + form.advertisingCostUSD + form.extraCostsUSD,
    [form.purchasePriceUSD, form.shippingCostUSD, form.advertisingCostUSD, form.extraCostsUSD]
  );

  const totalCostPEN = useMemo(() => totalCostUSD * form.exchangeRate, [totalCostUSD, form.exchangeRate]);

  const taxesPEN = useMemo(() => {
    const fob = form.purchasePriceUSD + form.shippingCostUSD;
    if (fob <= 200) return 0;
    const fobPEN = fob * form.exchangeRate;
    const adValorem = fobPEN * 0.04;
    const baseIGV = fobPEN + adValorem;
    const igv = baseIGV * 0.18;
    const percepcion = baseIGV * 0.10;
    return igv + percepcion;
  }, [form.purchasePriceUSD, form.shippingCostUSD, form.exchangeRate]);

  const profitPEN = useMemo(() => form.salePricePEN - totalCostPEN - taxesPEN, [form.salePricePEN, totalCostPEN, taxesPEN]);

  const setField = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Información de Compra */}
          <Section title="Información de Compra">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Orden #" value={form.orderNumber} onChange={(v) => setField('orderNumber', v)} />
              <Field label="Fecha de Compra" value={form.estimatedArrival} onChange={(v) => setField('estimatedArrival', v)} type="date" />
              <Field label="Proveedor" value={form.supplier} onChange={(v) => setField('supplier', v)} />
            </div>
          </Section>

          {/* Logística */}
          <Section title="Logística">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Courier</Label>
                <Select value={form.courier} onValueChange={(v) => setField('courier', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {['DHL', 'FedEx', 'UPS', 'USPS', 'Estafeta', 'Otro'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Tracking" value={form.trackingNumber} onChange={(v) => setField('trackingNumber', v)} />
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={(v) => setField('status', v as ProductStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['USA', 'En Tránsito', 'Perú', 'Entregado'] as ProductStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Fecha Estimada" value={form.estimatedArrival} onChange={(v) => setField('estimatedArrival', v)} type="date" />
            </div>
          </Section>

          {/* Producto */}
          <Section title="Producto">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Descripción" value={form.description} onChange={(v) => setField('description', v)} />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={(v) => setField('category', v as ProductCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['Smartphone', 'Laptop', 'Tablet', 'Smartwatch', 'Accesorio', 'Otro'] as ProductCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Grado</Label>
                <Select value={form.grade} onValueChange={(v) => setField('grade', v as ProductGrade)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(['A', 'B', 'C'] as ProductGrade[]).map((g) => (
                      <SelectItem key={g} value={g}>Grado {g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Condición" value={form.condition} onChange={(v) => setField('condition', v)} />
            </div>
          </Section>

          {/* Control de Calidad */}
          <Section title="Control de Calidad">
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckItem label="Pantalla OK" checked={form.screenOk} onChange={(v) => setField('screenOk', v)} />
              <CheckItem label="Touch OK" checked={form.touchOk} onChange={(v) => setField('touchOk', v)} />
              <CheckItem label="Altavoces OK" checked={form.speakersOk} onChange={(v) => setField('speakersOk', v)} />
              <CheckItem label="Micrófono OK" checked={form.microphoneOk} onChange={(v) => setField('microphoneOk', v)} />
              <CheckItem label="WiFi OK" checked={form.wifiOk} onChange={(v) => setField('wifiOk', v)} />
              <CheckItem label="Bluetooth OK" checked={form.bluetoothOk} onChange={(v) => setField('bluetoothOk', v)} />
              <CheckItem label="Cámaras OK" checked={form.camerasOk} onChange={(v) => setField('camerasOk', v)} />
              <CheckItem label="Puertos OK" checked={form.portsOk} onChange={(v) => setField('portsOk', v)} />
              <CheckItem label="Botones OK" checked={form.buttonsOk} onChange={(v) => setField('buttonsOk', v)} />
              <CheckItem label="Teclado OK" checked={form.keyboardOk} onChange={(v) => setField('keyboardOk', v)} />
              <CheckItem label="Trackpad OK" checked={form.trackpadOk} onChange={(v) => setField('trackpadOk', v)} />
              <CheckItem label="Carcasa OK" checked={form.chassisOk} onChange={(v) => setField('chassisOk', v)} />
              <CheckItem label="Batería OK" checked={form.batteryOk} onChange={(v) => setField('batteryOk', v)} />
              <CheckItem label="Cargador Incluido" checked={form.chargerIncluded} onChange={(v) => setField('chargerIncluded', v)} />
              <CheckItem label="Caja Original" checked={form.originalBox} onChange={(v) => setField('originalBox', v)} />
              <Field label="Ciclos de Batería" value={form.batteryCycles?.toString() ?? ''} onChange={(v) => setField('batteryCycles', v ? parseInt(v, 10) : null)} type="number" />
            </div>
          </Section>

          {/* Finanzas USD */}
          <Section title="Finanzas USD">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Precio Compra (USD)" value={form.purchasePriceUSD.toString()} onChange={(v) => setField('purchasePriceUSD', parseFloat(v) || 0)} type="number" step="0.01" />
              <Field label="Costo Envío (USD)" value={form.shippingCostUSD.toString()} onChange={(v) => setField('shippingCostUSD', parseFloat(v) || 0)} type="number" step="0.01" />
              <Field label="Publicidad (USD)" value={form.advertisingCostUSD.toString()} onChange={(v) => setField('advertisingCostUSD', parseFloat(v) || 0)} type="number" step="0.01" />
              <Field label="Costos Extra (USD)" value={form.extraCostsUSD.toString()} onChange={(v) => setField('extraCostsUSD', parseFloat(v) || 0)} type="number" step="0.01" />
              <Field label="Tipo de Cambio (TC)" value={form.exchangeRate.toString()} onChange={(v) => setField('exchangeRate', parseFloat(v) || 0)} type="number" step="0.01" />
              <Field label="Precio Venta (PEN)" value={form.salePricePEN.toString()} onChange={(v) => setField('salePricePEN', parseFloat(v) || 0)} type="number" step="0.01" />
            </div>
          </Section>

          <Separator />

          {/* Auto-calculated */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h4 className="font-semibold text-sm">Cálculos Automáticos</h4>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Costo Total USD:</span>
                <span className="font-medium">${totalCostUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Costo Total PEN:</span>
                <span className="font-medium">S/ {totalCostPEN.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Impuestos PEN:</span>
                <span className="font-medium">S/ {taxesPEN.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ganancia PEN:</span>
                <Badge variant={profitPEN >= 0 ? 'default' : 'destructive'} className="font-medium">
                  S/ {profitPEN.toFixed(2)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 font-semibold text-sm text-muted-foreground uppercase tracking-wider">{title}</h4>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} step={step} />
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
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label className="text-sm cursor-pointer" onClick={() => onChange(!checked)}>{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
