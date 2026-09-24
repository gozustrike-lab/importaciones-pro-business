import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { db } from '@/lib/db';

// PATCH /api/shipments/[id] - Update shipment status, AWB or WhatsApp notes
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId || !currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const shipment = await db.shipment.findFirst({
      where: { id, tenantId: currentUser.tenantId },
      include: { products: true },
    });

    if (!shipment) {
      return NextResponse.json({ error: 'Embarque no encontrado' }, { status: 404 });
    }

    const updateData: any = {};

    if (body.awbNumber !== undefined) {
      updateData.awbNumber = body.awbNumber.trim();
      if (body.awbNumber && shipment.status === 'ENVIADO') {
        updateData.status = 'CONFIRMADO_AWB';
        updateData.confirmedAt = new Date();
      }
    }

    if (body.whatsappNotes !== undefined) {
      updateData.whatsappNotes = body.whatsappNotes;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'EN_LIMA' || body.status === 'RECIBIDO') {
        updateData.arrivedLimaAt = new Date();
      }
    }

    // If marked as received in Lima
    if (body.markReceived === true || body.status === 'RECIBIDO') {
      updateData.status = 'RECIBIDO';
      updateData.deliveredAt = new Date();

      // Update all products in this shipment to RECIBIDO
      await db.product.updateMany({
        where: { shipmentId: shipment.id },
        data: {
          shippingStatus: 'Recibido',
          actualArrival: new Date(),
        },
      });
    }

    const updatedShipment = await db.shipment.update({
      where: { id: shipment.id },
      data: updateData,
      include: { products: true },
    });

    return NextResponse.json({
      message: 'Embarque actualizado con éxito',
      shipment: updatedShipment,
    });
  } catch (error) {
    console.error('Error actualizando embarque:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar embarque' },
      { status: 500 }
    );
  }
}

// DELETE /api/shipments/[id] - Remove shipment and unlink products
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId || !currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const shipment = await db.shipment.findFirst({
      where: { id, tenantId: currentUser.tenantId },
    });

    if (!shipment) {
      return NextResponse.json({ error: 'Embarque no encontrado' }, { status: 404 });
    }

    // Unlink products back to USA status
    await db.product.updateMany({
      where: { shipmentId: shipment.id },
      data: {
        shipmentId: null,
        shippingStatus: 'USA',
      },
    });

    await db.shipment.delete({ where: { id: shipment.id } });

    return NextResponse.json({ message: 'Embarque eliminado y productos devueltos a casillero USA' });
  } catch (error) {
    console.error('Error eliminando embarque:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar embarque' },
      { status: 500 }
    );
  }
}
