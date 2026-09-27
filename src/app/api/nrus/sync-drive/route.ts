import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { syncComprasEbay } from '@/lib/sync-compras-ebay';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const result = await syncComprasEbay();

    return NextResponse.json({
      success: true,
      message: `Sincronización completada con éxito: ${result.salesUpdated} períodos de ventas y ${result.purchasesCreated + result.purchasesUpdated} compras actualizadas desde la carpeta local/Drive.`,
      result,
    });
  } catch (error: any) {
    console.error('Error in sync-drive route:', error);
    return NextResponse.json(
      { error: error?.message || 'Error durante la sincronización de la carpeta local/Drive' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
