'use client';

import { useState } from 'react';
import { Calculator, Info } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { calculateTax } from '@/lib/api';
import type { TaxCalculation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ImpuestosTab() {
  const { toast } = useToast();
  const [fobUSD, setFobUSD] = useState('300');
  const [shippingUSD, setShippingUSD] = useState('30');
  const [exchangeRate, setExchangeRate] = useState('3.72');
  const [result, setResult] = useState<TaxCalculation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    const fob = parseFloat(fobUSD) || 0;
    const shipping = parseFloat(shippingUSD) || 0;
    const rate = parseFloat(exchangeRate) || 0;

    if (fob <= 0) {
      toast({ title: 'Error', description: 'El FOB debe ser mayor a 0', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      const data = await calculateTax({ fobUSD: fob, shippingUSD: shipping, exchangeRate: rate });
      setResult(data);
    } catch {
      toast({ title: 'Error', description: 'No se pudo calcular los impuestos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const chartData = result
    ? [
        { name: 'FOB', value: result.fobPEN },
        { name: 'Ad/Valorem', value: result.adValorem },
        { name: 'IGV', value: result.igv },
        { name: 'Percepción', value: result.percepcion },
      ]
    : [];

  const barChartConfig: ChartConfig = {
    value: { label: 'Monto (PEN)', color: '#10b981' },
    FOB: { label: 'FOB', color: '#6366f1' },
    'Ad/Valorem': { label: 'Ad/Valorem', color: '#f59e0b' },
    IGV: { label: 'IGV', color: '#ef4444' },
    Percepción: { label: 'Percepción', color: '#8b5cf6' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Impuestos</h2>
        <p className="text-muted-foreground">Calculadora de impuestos de importación Perú</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calculator */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">Calculadora de Impuestos</CardTitle>
            </div>
            <CardDescription>Ingresa los valores para calcular los impuestos de importación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fob">FOB (USD)</Label>
              <Input
                id="fob"
                type="number"
                step="0.01"
                placeholder="Ej: 300.00"
                value={fobUSD}
                onChange={(e) => setFobUSD(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipping">Costo Envío (USD)</Label>
              <Input
                id="shipping"
                type="number"
                step="0.01"
                placeholder="Ej: 30.00"
                value={shippingUSD}
                onChange={(e) => setShippingUSD(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tc">Tipo de Cambio</Label>
              <Input
                id="tc"
                type="number"
                step="0.01"
                placeholder="Ej: 3.72"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
            </div>

            <Button
              onClick={handleCalculate}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? 'Calculando...' : 'Calcular Impuestos'}
            </Button>

            {/* Results */}
            {result && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <h4 className="font-semibold text-sm">Resultado</h4>
                {result.exempt ? (
                  <div className="text-center py-4">
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 px-4 py-1.5 text-sm">
                      ✓ EXENTO DE IMPUESTOS
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      FOB ≤ $200 USD — No aplica impuestos de importación
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <ResultRow label="FOB (PEN)" value={formatPEN(result.fobPEN)} />
                    <ResultRow label="Ad/Valorem (4%)" value={formatPEN(result.adValorem)} />
                    <ResultRow label="Base IGV" value={formatPEN(result.baseIGV)} />
                    <ResultRow label="IGV (18%)" value={formatPEN(result.igv)} />
                    <ResultRow label="Percepción (10%)" value={formatPEN(result.percepcion)} />
                    <Separator />
                    <ResultRow
                      label="Total Impuestos"
                      value={formatPEN(result.totalTaxesPEN)}
                      bold
                      className="text-emerald-600"
                    />
                    <ResultRow
                      label="Total Impuestos (USD)"
                      value={`$ ${result.totalTaxesUSD.toFixed(2)}`}
                      bold
                      className="text-emerald-600"
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart + Rules */}
        <div className="space-y-6">
          {/* Chart */}
          {result && !result.exempt && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Desglose Visual</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={barChartConfig} className="h-[250px] w-full">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={entry.name} fill={['#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'][index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Rules Reference */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base">Reglas de Impuestos</CardTitle>
              </div>
              <CardDescription>Normativa vigente para importaciones a Perú</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-emerald-600">Regla 1</Badge>
                  <span className="font-semibold text-sm">FOB {'>'} $200 USD</span>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Aplicar 4% de Ad/Valorem sobre FOB</li>
                  <li>• Aplicar 18% de IGV sobre (FOB + Ad/Valorem)</li>
                  <li>• Aplicar 10% de Percepción sobre (FOB + Ad/Valorem + IGV)</li>
                </ul>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-sky-600">Regla 2</Badge>
                  <span className="font-semibold text-sm">FOB ≤ $200 USD</span>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Sin impuestos (exento de importación)</li>
                  <li>• No aplica Ad/Valorem, IGV ni Percepción</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  bold,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className={bold ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
      <span className={`${bold ? 'font-bold' : 'font-medium'} ${className || ''}`}>{value}</span>
    </div>
  );
}


