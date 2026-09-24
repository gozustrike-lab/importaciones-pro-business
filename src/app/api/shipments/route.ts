import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { db } from '@/lib/db';

// GET /api/shipments - List all shipments with their products
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId || !currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const shipments = await db.shipment.findMany({
      where: { tenantId: currentUser.tenantId },
      include: {
        products: {
          select: {
            id: true,
            description: true,
            trackingId: true,
            courier: true,
            purchasePriceUsd: true,
            shippingStatus: true,
            model: true,
            condition: true,
            orderNumber: true,
          },
        },
      },
      orderBy: { flightDate: 'desc' },
    });

    return NextResponse.json({ shipments });
  } catch (error) {
    console.error('Error obteniendo embarques:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener embarques' },
      { status: 500 }
    );
  }
}

// POST /api/shipments - Register a new official Shipment
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId || !currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const {
      flightDate,
      flightDayLabel,
      importerProfile,
      consigneeName,
      consigneeRuc,
      productIds = [],
      trackingNumbers = [],
      fallbackFobUsd = 0,
      notes = '',
      whatsappNotes = '',
      awbNumber = '',
    } = body;

    if (!consigneeName || !consigneeRuc) {
      return NextResponse.json({ error: 'Faltan datos obligatorios del consignatario' }, { status: 400 });
    }

    const parsedFlightDate = flightDate ? new Date(flightDate) : new Date();
    const dateFormatted = parsedFlightDate.toISOString().slice(0, 10).replace(/-/g, '');

    // Count existing shipments for this date & profile to generate a unique code
    const existingCount = await db.shipment.count({
      where: {
        tenantId: currentUser.tenantId,
        importerProfile,
      },
    });

    const code = `EMB-${dateFormatted}-${importerProfile.toUpperCase()}-${String(existingCount + 1).padStart(2, '0')}`;

    // Get products to calculate FOB total and link
    const searchConditions: any[] = [];
    if (productIds.length > 0) searchConditions.push({ id: { in: productIds } });
    if (trackingNumbers.length > 0) searchConditions.push({ trackingId: { in: trackingNumbers } });

    const products = searchConditions.length > 0
      ? await db.product.findMany({
          where: {
            OR: searchConditions,
            tenantId: currentUser.tenantId,
          },
        })
      : [];

    const calculatedFob = products.reduce((acc, p) => acc + (p.purchasePriceUsd || 0), 0);
    const totalFobUsd = calculatedFob > 0 ? calculatedFob : (Number(fallbackFobUsd) || 0);
    const finalItemsCount = products.length > 0 ? products.length : (body.totalItems || 1);
    const isUnder200 = totalFobUsd <= 200.0;

    const shipment = await db.shipment.create({
      data: {
        code,
        flightDate: parsedFlightDate,
        flightDayLabel: flightDayLabel || `EMBARCACION ${dateFormatted}`,
        importerProfile: importerProfile || 'fabio',
        consigneeName,
        consigneeRuc,
        courierName: 'Shipper',
        awbNumber: awbNumber || '',
        status: awbNumber ? 'CONFIRMADO_AWB' : 'ENVIADO',
        totalItems: finalItemsCount,
        totalFobUsd: Math.round(totalFobUsd * 100) / 100,
        isUnder200,
        notes,
        whatsappNotes,
        tenantId: currentUser.tenantId,
      },
    });

    // Link products to this shipment and update their shipping status
    if (products.length > 0) {
      await db.product.updateMany({
        where: { id: { in: products.map((p) => p.id) } },
        data: {
          shipmentId: shipment.id,
          shippingStatus: 'En Tránsito',
        },
      });
    }

    return NextResponse.json({
      message: 'Embarque registrado con éxito en la bitácora',
      shipment,
    });
  } catch (error) {
    console.error('Error creando embarque:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al registrar embarque' },
      { status: 500 }
    );
  }
}
