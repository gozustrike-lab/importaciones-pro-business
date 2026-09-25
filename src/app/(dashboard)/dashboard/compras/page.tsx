'use client';

import { ComprasTab } from '@/components/dashboard/compras-tab';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ComprasStandalonePage() {
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1900px] mx-auto space-y-4">
        <div className="flex items-center justify-between pb-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Dashboard General</span>
          </Link>
          <span className="text-xs text-muted-foreground font-mono">
            Modo Ventana Independiente
          </span>
        </div>

        <ComprasTab isStandalone={true} />
      </div>
    </div>
  );
}
