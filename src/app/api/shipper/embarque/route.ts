import { NextRequest, NextResponse } from 'next/server';
import { generateEmbarqueWorkbook, EmbarqueRow } from '@/lib/shipper-generator';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    let defaultRuc = '10762026835';
    let defaultName = 'FABIO CESAR HERRERA BONILLA';

    if (session?.user) {
      const dbUser = await db.user.findUnique({
        where: { email: session.user.email! },
        include: { tenant: true },
      });
      if (dbUser?.tenant) {
        defaultRuc = dbUser.tenant.ruc || defaultRuc;
        defaultName = dbUser.tenant.ownerName || dbUser.name || defaultName;
      }
    }

    const body = await request.json();
    const items: EmbarqueRow[] = body.items || [];

    if (!items.length) {
      return NextResponse.json({ error: 'No se enviaron ítems para la orden de embarque' }, { status: 400 });
    }

    const buffer = await generateEmbarqueWorkbook(items, {
      ruc: body.ruc || defaultRuc,
      name: body.name || defaultName,
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `SHIPER_ORDEN_DE_EMBARQUE_${dateStr}.xlsx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generando orden de embarque:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error desconocido al generar orden de embarque' },
      { status: 500 }
    );
  }
}
