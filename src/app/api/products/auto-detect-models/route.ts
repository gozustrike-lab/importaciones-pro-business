import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helper';
import { inferTechnicalModel } from '@/lib/shipper-classification';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const allProducts = await db.product.findMany({
      where: {
        tenantId: currentUser.tenantId,
      },
    });

    const candidates = allProducts.filter(
      (p) => !p.model || p.model.trim() === '' || p.model === 'Sin modelo'
    );

    let updatedCount = 0;
    const updates: Array<{ id: string; desc: string; model: string }> = [];

    for (const p of candidates) {
      const inferred = inferTechnicalModel(p.description);
      if (inferred) {
        await db.product.update({
          where: { id: p.id },
          data: { model: inferred },
        });
        updatedCount++;
        updates.push({ id: p.id, desc: p.description, model: inferred });
      }
    }

    return NextResponse.json({
      success: true,
      scanned: candidates.length,
      updatedCount,
      samples: updates.slice(0, 10),
    });
  } catch (error: any) {
    console.error('Error auto-detecting models:', error);
    return NextResponse.json({ error: error.message || 'Error auto-detectando modelos' }, { status: 500 });
  }
}
