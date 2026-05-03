'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Settings } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { fetchNRUSStatus, fetchNRUSConfig, updateNRUSConfig } from '@/lib/api';
import type { NRUSStatus, NRUSConfig } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

function formatPEN(n: number) {
  return `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const alertColors: Record<string, string> = {
  normal: 'bg-emerald-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
};

const catBadgeStyles: Record<string, string> = {
  'Cat 1': 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  'Cat 2': 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  Excedido: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
};

export function NRUSTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState<NRUSStatus | null>(null);
  const [config, setConfig] = useState<NRUSConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable config form
  const [cat1Limit, setCat1Limit] = useState('5000');
  const [cat2Limit, setCat2Limit] = useState('8000');
  const [igvRate, setIgvRate] = useState('18');
  const [adValoremRate, setAdValoremRate] = useState('4');
  const [percepcionRate, setPercepcionRate] = useState('10');

  const loadData = async () => {
    try {
      setLoading(true);
      const [s, c] = await Promise.all([fetchNRUSStatus(), fetchNRUSConfig()]);
      setStatus(s);
      setConfig(c);
      setCat1Limit(c.category1Limit.toString());
      setCat2Limit(c.category2Limit.toString());
      setIgvRate(c.igvRate.toString());
      setAdValoremRate(c.adValoremRate.toString());
      setPercepcionRate(c.percepcionRate.toString());
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar la información NRUS', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await updateNRUSConfig({
        category1Limit: parseFloat(cat1Limit) || 5000,
        category2Limit: parseFloat(cat2Limit) || 8000,
        igvRate: parseFloat(igvRate) || 18,
        adValoremRate: parseFloat(adValoremRate) || 4,
        percepcionRate: parseFloat(percepcionRate) || 10,
      });
      toast({ title: 'Configuración guardada', description: 'Los umbrales NRUS se actualizaron correctamente.' });
      await loadData();
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la configuración', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const salesPct = status ? Math.min((status.monthlySales / status.category2Limit) * 100, 100) : 0;
  const cat1Pct = status ? Math.min((status.monthlySales / status.category1Limit) * 100, 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">NRUS</h2>
        <p className="text-muted-foreground">Nuevo Régimen Único Simplificado — Control de ventas mensuales</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">Estado Actual</CardTitle>
            </div>
            <CardDescription>
              {status ? `${status.currentMonth} ${status.currentYear}` : 'Sin datos'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category Badge */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Categoría Actual:</span>
              <Badge variant="outline" className={status ? catBadgeStyles[status.currentCategory] || '' : ''}>
                {status?.currentCategory || 'N/A'}
              </Badge>
              <div className={`h-3 w-3 rounded-full ${status ? alertColors[status.alertLevel] || alertColors.normal : ''}`} />
            </div>

            {/* Sales vs Cat 2 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Ventas del Mes</span>
                <span className="font-semibold">
                  {status ? formatPEN(status.monthlySales) : 'S/ 0'} / {status ? formatPEN(status.category2Limit) : 'S/ 8,000'}
                </span>
              </div>
              <Progress value={salesPct} className="h-4" />
            </div>

            {/* Sales vs Cat 1 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Límite Cat 1 ({status ? formatPEN(status.category1Limit) : 'S/ 5,000'})</span>
                <span className="font-medium">{cat1Pct.toFixed(0)}%</span>
              </div>
              <Progress value={cat1Pct} className="h-3" />
            </div>

            {/* Tax rates */}
            {status && (
              <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-600">{status.igvRate}%</div>
                  <div className="text-xs text-muted-foreground">IGV</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600">{status.adValoremRate}%</div>
                  <div className="text-xs text-muted-foreground">Ad/Valorem</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">{status.percepcionRate}%</div>
                  <div className="text-xs text-muted-foreground">Percepción</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">Configuración NRUS</CardTitle>
            </div>
            <CardDescription>Ajusta los umbrales y tasas del régimen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Límite Categoría 1 (PEN)</Label>
                <Input
                  type="number"
                  value={cat1Limit}
                  onChange={(e) => setCat1Limit(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Límite Categoría 2 (PEN)</Label>
                <Input
                  type="number"
                  value={cat2Limit}
                  onChange={(e) => setCat2Limit(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>IGV (%)</Label>
                <Input
                  type="number"
                  value={igvRate}
                  onChange={(e) => setIgvRate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Ad/Valorem (%)</Label>
                <Input
                  type="number"
                  value={adValoremRate}
                  onChange={(e) => setAdValoremRate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Percepción (%)</Label>
                <Input
                  type="number"
                  value={percepcionRate}
                  onChange={(e) => setPercepcionRate(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleSaveConfig}
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Alert Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Reglas de Alerta</CardTitle>
          </div>
          <CardDescription>Notificaciones automáticas según nivel de ventas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 pr-4 font-semibold">Categoría</th>
                  <th className="text-left py-3 pr-4 font-semibold">Límite</th>
                  <th className="text-left py-3 pr-4 font-semibold">Alerta 80%</th>
                  <th className="text-left py-3 pr-4 font-semibold">Alerta 90%</th>
                  <th className="text-left py-3 font-semibold">Alerta 100%</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3 pr-4 font-medium">Cat 1</td>
                  <td className="py-3 pr-4">{config ? formatPEN(config.category1Limit) : 'S/ 5,000'}</td>
                  <td className="py-3 pr-4">
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">80% ({config ? formatPEN(config.category1Limit * 0.8) : 'S/ 4,000'})</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">90% ({config ? formatPEN(config.category1Limit * 0.9) : 'S/ 4,500'})</Badge>
                  </td>
                  <td className="py-3">
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">100% ({config ? formatPEN(config.category1Limit) : 'S/ 5,000'})</Badge>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium">Cat 2</td>
                  <td className="py-3 pr-4">{config ? formatPEN(config.category2Limit) : 'S/ 8,000'}</td>
                  <td className="py-3 pr-4">
                    <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">80% ({config ? formatPEN(config.category2Limit * 0.8) : 'S/ 6,400'})</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">90% ({config ? formatPEN(config.category2Limit * 0.9) : 'S/ 7,200'})</Badge>
                  </td>
                  <td className="py-3">
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">100% ({config ? formatPEN(config.category2Limit) : 'S/ 8,000'})</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
