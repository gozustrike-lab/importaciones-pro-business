'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Package, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    companyName: '',
    ruc: '',
    ownerName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          ruc: formData.ruc,
          ownerName: formData.ownerName,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al crear la cuenta');
        return;
      }

      // Auto sign in after registration
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        router.push('/login');
      }
    } catch (err) {
      setError('Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-transparent to-transparent" />

      <Card className="relative w-full max-w-md border-zinc-800 bg-zinc-900/80 backdrop-blur-sm shadow-2xl">
        <CardHeader className="space-y-4 text-center pb-2">
          {/* Logo */}
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-600 shadow-lg shadow-emerald-600/25">
              <Package className="h-7 w-7 text-white" />
            </div>
          </div>

          <div>
            <CardTitle className="text-2xl font-bold text-white">
              Crear Cuenta
            </CardTitle>
            <CardDescription className="text-zinc-400 mt-1">
              Registra tu empresa en ImportHub Perú
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-zinc-300 text-sm">
                <Building2 className="inline h-3.5 w-3.5 mr-1.5" />
                Nombre de Empresa
              </Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Importaciones SAC"
                value={formData.companyName}
                onChange={(e) => updateField('companyName', e.target.value)}
                required
                className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-11"
                disabled={isLoading}
              />
            </div>

            {/* RUC */}
            <div className="space-y-2">
              <Label htmlFor="ruc" className="text-zinc-300 text-sm">
                RUC
              </Label>
              <Input
                id="ruc"
                type="text"
                placeholder="20123456789"
                maxLength={11}
                value={formData.ruc}
                onChange={(e) => updateField('ruc', e.target.value)}
                required
                className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-11"
                disabled={isLoading}
              />
            </div>

            {/* Owner Name */}
            <div className="space-y-2">
              <Label htmlFor="ownerName" className="text-zinc-300 text-sm">
                Nombre Completo
              </Label>
              <Input
                id="ownerName"
                type="text"
                placeholder="Fabio Herrera Bonilla"
                value={formData.ownerName}
                onChange={(e) => updateField('ownerName', e.target.value)}
                required
                className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-11"
                disabled={isLoading}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300 text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@empresa.com"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
                className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-11"
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300 text-sm">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  required
                  minLength={6}
                  className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-11 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-zinc-300 text-sm">
                Confirmar Contraseña
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite tu contraseña"
                value={formData.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                required
                minLength={6}
                className="border-zinc-700 bg-zinc-800/50 text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-11"
                disabled={isLoading}
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium h-11 transition-colors"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                'Crear Cuenta'
              )}
            </Button>
          </form>

          {/* Login link */}
          <p className="mt-6 text-center text-sm text-zinc-500">
            ¿Ya tienes cuenta?{' '}
            <Link
              href="/login"
              className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              Inicia sesión
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
