import { NextRequest, NextResponse } from 'next/server';
import { generateTraduccionWorkbook, TraduccionRow } from '@/lib/shipper-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items: TraduccionRow[] = body.items || [];
    const awbNumber: string = body.awb || '';

    if (!items.length) {
      return NextResponse.json({ error: 'No se enviaron ítems para la traducción de factura' }, { status: 400 });
    }

    const buffer = await generateTraduccionWorkbook(items, awbNumber);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `DECLARACION_JURADA_TRADUCCION_${dateStr}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generando traducción de factura:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al generar traducción' },
      { status: 500 }
    );
  }
}
