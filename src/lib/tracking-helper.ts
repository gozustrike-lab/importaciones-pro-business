export interface TrackingCheckpoint {
  status: string;
  location: string;
  description: string;
  timestamp: Date;
}

export function generateCheckpoints(product: {
  id: string;
  trackingId?: string | null;
  courier?: string | null;
  shippingStatus?: string | null;
  shipperConfirmed?: boolean | null;
  shipperTracking?: string | null;
  purchaseDate?: Date | null;
  actualArrival?: Date | null;
  estimatedArrival?: Date | null;
  createdAt?: Date | null;
}): TrackingCheckpoint[] {
  const courierUpper = (product.courier || 'UPS').toUpperCase();
  const baseDate = product.purchaseDate ? new Date(product.purchaseDate) : (product.createdAt ? new Date(product.createdAt) : new Date());
  
  let arrivalDate: Date;
  if (product.actualArrival) {
    arrivalDate = new Date(product.actualArrival);
  } else if (product.estimatedArrival) {
    arrivalDate = new Date(product.estimatedArrival);
  } else {
    arrivalDate = new Date(baseDate.getTime() + (courierUpper.includes('USPS') ? 5 : 3) * 24 * 60 * 60 * 1000);
  }

  const status = product.shippingStatus || 'USA';
  const isDeliveredToMiami = status === 'USA' || status === 'Entregado' || Boolean(product.actualArrival);
  const isDeliveredToPeru = status === 'Entregado';
  const isInTransit = status === 'TRANSITO_USA' || status === 'En Tránsito';

  const checkpoints: TrackingCheckpoint[] = [];

  // Step 1: Label Created / Origin Pickup
  const d0 = new Date(baseDate.getTime() + 4 * 3600 * 1000);
  if (courierUpper.includes('UPS')) {
    checkpoints.push({
      status: 'Etiqueta Creada',
      location: 'Dallas, TX, US',
      description: 'El remitente ha creado una etiqueta; UPS está esperando el paquete.',
      timestamp: d0,
    });
    const d1 = new Date(baseDate.getTime() + 18 * 3600 * 1000);
    checkpoints.push({
      status: 'Escaneo de Origen',
      location: 'Mesquite, TX, US',
      description: 'Paquete recibido en la instalación de origen de UPS.',
      timestamp: d1,
    });
  } else if (courierUpper.includes('USPS')) {
    checkpoints.push({
      status: 'Info Electrónica Recibida',
      location: 'LOS ANGELES, CA 90001',
      description: 'Shipping Label Created, USPS Awaiting Item.',
      timestamp: d0,
    });
    const d1 = new Date(baseDate.getTime() + 20 * 3600 * 1000);
    checkpoints.push({
      status: 'Aceptado por USPS',
      location: 'LOS ANGELES CA DISTRIBUTION CENTER',
      description: 'Accepted at USPS Origin Sort Facility.',
      timestamp: d1,
    });
  } else {
    // FedEx
    checkpoints.push({
      status: 'Información Enviada',
      location: 'MEMPHIS, TN',
      description: 'Shipment information sent to FedEx.',
      timestamp: d0,
    });
    const d1 = new Date(baseDate.getTime() + 16 * 3600 * 1000);
    checkpoints.push({
      status: 'Recolectado',
      location: 'MEMPHIS, TN',
      description: 'Picked up by FedEx.',
      timestamp: d1,
    });
  }

  // Step 2: Transit Hub
  const d2 = new Date(baseDate.getTime() + 36 * 3600 * 1000);
  if (courierUpper.includes('UPS')) {
    checkpoints.push({
      status: 'En Tránsito',
      location: 'Jacksonville, FL, US',
      description: 'Escaneo de salida de la instalación intermedia de UPS.',
      timestamp: d2,
    });
  } else if (courierUpper.includes('USPS')) {
    checkpoints.push({
      status: 'En Tránsito',
      location: 'OPA LOCKA FL DISTRIBUTION CENTER',
      description: 'Arrived at USPS Regional Destination Facility.',
      timestamp: d2,
    });
  } else {
    checkpoints.push({
      status: 'En Tránsito',
      location: 'ORLANDO, FL',
      description: 'Arrived at FedEx location.',
      timestamp: d2,
    });
  }

  if (isInTransit) {
    const dNow = new Date(d2.getTime() + 12 * 3600 * 1000);
    checkpoints.push({
      status: 'En Tránsito USA',
      location: 'MIAMI, FL',
      description: 'En camino hacia la instalación de destino en Miami, FL.',
      timestamp: dNow,
    });
    return checkpoints;
  }

  // Step 3: Out for Delivery in Miami
  const d3 = new Date(arrivalDate.getTime() - 4 * 3600 * 1000);
  if (courierUpper.includes('UPS')) {
    checkpoints.push({
      status: 'En Reparto',
      location: 'Miami, FL, US',
      description: 'En vehículo de UPS para entrega el día de hoy.',
      timestamp: d3,
    });
  } else if (courierUpper.includes('USPS')) {
    checkpoints.push({
      status: 'En Reparto',
      location: 'MIAMI, FL 33172',
      description: 'Out for Delivery, Expected Delivery by 4:00pm.',
      timestamp: d3,
    });
  } else {
    checkpoints.push({
      status: 'En Reparto',
      location: 'MIAMI, FL',
      description: 'On FedEx vehicle for delivery.',
      timestamp: d3,
    });
  }

  // Step 4: Delivered in Miami Warehouse
  if (courierUpper.includes('UPS')) {
    checkpoints.push({
      status: 'Entregado en Miami',
      location: 'Miami, FL 33172, US',
      description: 'Entregado. Recibido por: SHIPPERS / DOCK. Dejado en el muelle de recepción.',
      timestamp: arrivalDate,
    });
  } else if (courierUpper.includes('USPS')) {
    checkpoints.push({
      status: 'Entregado en Miami',
      location: 'MIAMI, FL 33172',
      description: 'Delivered, Left with Individual / Front Desk at Shipper Warehouse.',
      timestamp: arrivalDate,
    });
  } else {
    checkpoints.push({
      status: 'Entregado en Miami',
      location: 'MIAMI, FL 33172',
      description: 'Delivered. Signed for by: SHIPPERS WAREHOUSE.',
      timestamp: arrivalDate,
    });
  }

  // Step 5: Shipper Warehouse Verification
  const dShipper = new Date(arrivalDate.getTime() + 18 * 3600 * 1000);
  if (product.shipperConfirmed) {
    checkpoints.push({
      status: 'Almacén Shiper OK',
      location: 'Shiper Courier Miami (8298 NW 68th St)',
      description: `Paquete ingresado y confirmado en sistema de Shiper. Guía física cotejada${product.shipperTracking ? ` (Ref: ${product.shipperTracking})` : ''}. Listo para manifiesto de vuelo.`,
      timestamp: dShipper,
    });
  } else if (!isDeliveredToPeru) {
    checkpoints.push({
      status: 'Pendiente en Shiper',
      location: 'Shiper Courier Miami',
      description: 'Entregado por el carrier local. En proceso de ingreso físico y verificación de casillero por Shiper (1-2 días).',
      timestamp: dShipper,
    });
  }

  // Step 6: Peru Shipment & Delivery (if Entregado)
  if (isDeliveredToPeru) {
    const dFlight = new Date(arrivalDate.getTime() + 2 * 24 * 3600 * 1000);
    checkpoints.push({
      status: 'Embarque Aéreo',
      location: 'Miami International Airport (MIA) -> LIM',
      description: 'Embarcado en vuelo de carga internacional consolidado Miami - Lima.',
      timestamp: dFlight,
    });

    const dCustoms = new Date(dFlight.getTime() + 36 * 3600 * 1000);
    checkpoints.push({
      status: 'Aduanas SUNAT Perú',
      location: 'Aeropuerto Jorge Chávez, Callao, PE',
      description: 'Declaración aduanera conforme bajo régimen NRUS / Importación simplificada. Sin incidencias.',
      timestamp: dCustoms,
    });

    const dFinal = new Date(dCustoms.getTime() + 24 * 3600 * 1000);
    checkpoints.push({
      status: 'Entregado en Perú',
      location: 'Lima, Perú',
      description: 'Carga recibida conforme en almacén central de Lima. Inspección física y control de calidad completados.',
      timestamp: dFinal,
    });
  }

  return checkpoints;
}
