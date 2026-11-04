import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-helper';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.userId || !currentUser.tenantId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { rawText, apply = true } = await request.json();
    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json({ error: 'Texto de WhatsApp requerido' }, { status: 400 });
    }

    const text = rawText.trim();
    const results: {
      type: 'ARRIVAL_NOTICE' | 'DATE_CONFIRMATION' | 'TRACKING_VERIFY' | 'UNKNOWN';
      shipments: any[];
      trackingsConfirmed: string[];
      trackingsMissing: string[];
      appliedChanges: string[];
    } = {
      type: 'UNKNOWN',
      shipments: [],
      trackingsConfirmed: [],
      trackingsMissing: [],
      appliedChanges: [],
    };

    // 1. Detect Arrival Notice ("llegó a Lima" / "llegaron a Lima" / "HAWBO")
    if (text.includes('llegó a Lima') || text.includes('llegaron a Lima') || text.includes('HAWBO')) {
      results.type = 'ARRIVAL_NOTICE';

      const linkMatch = text.match(/https:\/\/whs\.shiper\.pe\/tracking\/guias\/([a-z0-9]+)/i);
      const trackingUrl = linkMatch ? linkMatch[0] : null;

      const headerEmbarque = text.match(/EMBARQUE\s+([0-9]{1,2}(?:[\s/-]+[0-9]{1,2})?(?:[\s/-]+[0-9]{2,4})?)/i);
      const headerDate = headerEmbarque ? headerEmbarque[1].trim() : null;

      const subBlocks = text.split(/(?=[1-9]️⃣)/);

      if (subBlocks.length > 1) {
        for (let i = 1; i < subBlocks.length; i++) {
          const block = subBlocks[i];
          const hawbMatch = block.match(/HAWBO\d+/i);
          const ccMatch = block.match(/#?(CC\d+)/i);
          const nameMatch = block.match(/(HERRERA BONILLA FABIO CESAR|BONILLA ORDUÑA PEGGY LILIANA|PEGGY LILIANA BONILLA|FABIO CESAR HERRERA)/i);
          const bultosMatch = block.match(/(\d+)\s+bultos?/i);
          const kgMatch = block.match(/([0-9.]+)\s*kg/i);
          const costMatch = block.match(/\$([0-9.]+)/i);

          const isPeggy = nameMatch ? nameMatch[0].toUpperCase().includes('PEGGY') : block.toUpperCase().includes('PEGGY');
          const consigneeName = isPeggy ? 'BONILLA ORDUÑA PEGGY LILIANA' : 'HERRERA BONILLA FABIO CESAR';
          const consigneeRuc = isPeggy ? '10091870911' : '10762026835';
          const importerProfile = isPeggy ? 'peggy' : 'fabio';

          results.shipments.push({
            hawb: hawbMatch ? hawbMatch[0].toUpperCase() : null,
            ccCode: ccMatch ? ccMatch[1].toUpperCase() : null,
            consigneeName,
            consigneeRuc,
            importerProfile,
            bultos: bultosMatch ? parseInt(bultosMatch[1], 10) : 1,
            weightKg: kgMatch ? parseFloat(kgMatch[1]) : null,
            costUsd: costMatch ? parseFloat(costMatch[1]) : null,
            pickupLocation: block.includes('Recojo Surco') ? 'Recojo Surco' : 'Almacén Lima',
            trackingUrl,
            headerDate,
          });
        }
      } else {
        const hawbMatch = text.match(/GUÍA:\s*([A-Z0-9—-]+)/i);
        const ccMatch = text.match(/Embarque:\s*#?(CC\d+)/i);
        const nameMatch = text.match(/Consignatario:\s*([^\n]+)/i);
        const bultosMatch = text.match(/Bultos:\s*([^\n]+)/i);
        const kgMatch = text.match(/Peso:\s*([0-9.]+)\s*kg/i);
        const totalMatch = text.match(/Total:\s*\$([0-9.]+)/i);
        const modalMatch = text.match(/Modalidad:\s*([^\n]+)/i);

        let cleanHawb = hawbMatch ? hawbMatch[1].trim() : null;
        if (cleanHawb === '—' || cleanHawb === '-') cleanHawb = null;

        const isPeggy = nameMatch ? nameMatch[1].toUpperCase().includes('PEGGY') : text.toUpperCase().includes('PEGGY');
        const consigneeName = isPeggy ? 'BONILLA ORDUÑA PEGGY LILIANA' : 'HERRERA BONILLA FABIO CESAR';
        const consigneeRuc = isPeggy ? '10091870911' : '10762026835';
        const importerProfile = isPeggy ? 'peggy' : 'fabio';

        results.shipments.push({
          hawb: cleanHawb,
          ccCode: ccMatch ? ccMatch[1].toUpperCase() : null,
          consigneeName,
          consigneeRuc,
          importerProfile,
          bultos: bultosMatch && !bultosMatch[1].includes('—') ? parseInt(bultosMatch[1], 10) : 1,
          weightKg: kgMatch ? parseFloat(kgMatch[1]) : null,
          costUsd: totalMatch ? parseFloat(totalMatch[1]) : null,
          pickupLocation: modalMatch && !modalMatch[1].includes('—') ? modalMatch[1].trim() : 'Recojo Surco',
          trackingUrl,
          headerDate,
        });
      }

      if (apply) {
        for (const s of results.shipments) {
          const code = s.ccCode || s.hawb;
          if (!code) continue;

          let flightDate = new Date();
          let flightDayLabel = s.headerDate ? `VUELO ${s.headerDate}` : 'VUELO SHiPER';

          if (s.ccCode && s.ccCode.startsWith('CC26')) {
            const mm = parseInt(s.ccCode.slice(4, 6), 10) - 1;
            const dd = parseInt(s.ccCode.slice(6, 8), 10);
            flightDate = new Date(2026, mm, dd, 12, 0, 0);
            if (!s.headerDate) flightDayLabel = `VUELO ${dd}/${mm + 1}`;
          }

          const whatsappNotes = [
            s.trackingUrl ? `Link Rastreo: ${s.trackingUrl}` : '',
            s.weightKg ? `Peso: ${s.weightKg} kg` : '',
            s.costUsd ? `Liquidación: $${s.costUsd}` : '',
            s.pickupLocation ? `Modalidad: ${s.pickupLocation}` : '',
          ].filter(Boolean).join(' | ');

          const existing = await db.shipment.findUnique({ where: { code } });

          if (existing) {
            await db.shipment.update({
              where: { code },
              data: {
                awbNumber: s.hawb || existing.awbNumber,
                status: 'EN_LIMA',
                arrivedLimaAt: new Date(),
                flightDayLabel: s.headerDate ? `VUELO ${s.headerDate}` : existing.flightDayLabel,
                whatsappNotes: whatsappNotes || existing.whatsappNotes,
              },
            });
            results.appliedChanges.push(`Embarque existente actualizado: ${code} (Estado: EN_LIMA, AWB: ${s.hawb || 'PENDIENTE'})`);
          } else {
            await db.shipment.create({
              data: {
                code,
                flightDate,
                flightDayLabel,
                importerProfile: s.importerProfile,
                consigneeName: s.consigneeName,
                consigneeRuc: s.consigneeRuc,
                courierName: 'ShiPer',
                awbNumber: s.hawb || '',
                status: 'EN_LIMA',
                totalItems: s.bultos || 1,
                totalFobUsd: 0,
                isUnder200: true,
                whatsappNotes,
                tenantId: currentUser.tenantId,
                arrivedLimaAt: new Date(),
              },
            });
            results.appliedChanges.push(`Nuevo embarque registrado: ${code} (${s.consigneeName}, ${s.bultos} bultos, $${s.costUsd})`);
          }
        }
      }
    }

    // 2. Detect Date Confirmation (e.g. "Que fecha es el embarque ? -> 28/10")
    else if (
      text.toLowerCase().includes('fecha') ||
      /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(text)
    ) {
      results.type = 'DATE_CONFIRMATION';
      const dateMatch = text.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
      const dayMonth = dateMatch ? dateMatch[1] : null;

      if (dayMonth && apply) {
        // Find latest shipment in Lima or in transit to update its confirmed flight label
        const latestShipment = await db.shipment.findFirst({
          where: { tenantId: currentUser.tenantId },
          orderBy: { createdAt: 'desc' },
        });

        if (latestShipment) {
          await db.shipment.update({
            where: { id: latestShipment.id },
            data: {
              flightDayLabel: `VUELO ${dayMonth}`,
              whatsappNotes: latestShipment.whatsappNotes
                ? `${latestShipment.whatsappNotes} | Fecha confirmada en chat: ${dayMonth}`
                : `Fecha confirmada en chat: ${dayMonth}`,
            },
          });
          results.appliedChanges.push(
            `Fecha de vuelo confirmada (${dayMonth}) asignada al embarque reciente ${latestShipment.code}`
          );
        }
      }
    }

    // 3. Detect Tracking Inventory Verification (e.g. "... si figura en sistema")
    else if (text.toLowerCase().includes('figura en sistema')) {
      results.type = 'TRACKING_VERIFY';
      const lines = text.split('\n');

      for (const line of lines) {
        const l = line.trim();
        if (!l) continue;

        const isPositive = l.toLowerCase().includes('si figura en sistema');
        const isNegative = l.toLowerCase().includes('no figura en sistema');

        const trkMatch = l.match(/(?:(?:\(\d+\)\d+)+|(?:[1-9A-Z]{10,34}))/i);
        if (trkMatch) {
          const rawTrk = trkMatch[0];
          // Strip barcode parenthesized prefixes like (420)33166(92)
          const cleanTrk = rawTrk.replace(/\(\d+\)/g, '').trim();

          if (isPositive) {
            results.trackingsConfirmed.push(cleanTrk);
            if (apply) {
              const matchedProducts = await db.product.findMany({
                where: {
                  tenantId: currentUser.tenantId,
                  OR: [
                    { trackingId: { contains: cleanTrk } },
                    { shipperTracking: { contains: cleanTrk } },
                  ],
                },
              });

              for (const p of matchedProducts) {
                await db.product.update({
                  where: { id: p.id },
                  data: {
                    shipperConfirmed: true,
                    shipperTracking: rawTrk,
                    shippingStatus: 'USA',
                  },
                });
                results.appliedChanges.push(`Producto confirmado en almacén Miami: ${p.orderNumber} (${cleanTrk})`);
              }
            }
          } else if (isNegative) {
            results.trackingsMissing.push(cleanTrk);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error procesando mensaje de WhatsApp de ShiPer:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar mensaje' },
      { status: 500 }
    );
  }
}
