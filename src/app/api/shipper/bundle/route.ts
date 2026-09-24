import { NextRequest, NextResponse } from 'next/server';
import { generateEmbarqueWorkbook, generateTraduccionWorkbook, EmbarqueRow, TraduccionRow } from '@/lib/shipper-generator';
import JSZip from 'jszip';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const embarqueItems: EmbarqueRow[] = body.embarqueItems || [];
    const traduccionItems: TraduccionRow[] = body.traduccionItems || [];
    const awb: string = body.awb || '';
    const ruc: string = body.ruc || '10762026835';
    const name: string = body.name || 'FABIO CESAR HERRERA BONILLA';

    if (!embarqueItems.length) {
      return NextResponse.json({ error: 'No se enviaron ítems para el expediente' }, { status: 400 });
    }

    const zip = new JSZip();
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. Hoja de Embarque Excel
    const embarqueBuf = await generateEmbarqueWorkbook(embarqueItems, { ruc, name });
    zip.file(`1_SHIPER_ORDEN_DE_EMBARQUE_${dateStr}.xlsx`, embarqueBuf);

    // 2. Hoja de Traducción Excel
    const tradBuf = await generateTraduccionWorkbook(traduccionItems, awb);
    zip.file(`2_DECLARACION_JURADA_TRADUCCION_${dateStr}.xlsx`, tradBuf);

    // 3. Ficha RUC PDF
    const isPeggy = (body.profile || '').toLowerCase() === 'peggy';
    const rucFileName = isPeggy ? 'FICHA RUC LILIANA.pdf' : 'SUNAT - FICHA RUC FABIO.pdf';
    const rucZipLabel = isPeggy ? `3_SUNAT_FICHA_RUC_LILIANA_${ruc}.pdf` : `3_SUNAT_FICHA_RUC_FABIO_${ruc}.pdf`;
    const plantillasDir = fs.existsSync(path.join(process.cwd(), 'plantillas'))
      ? path.join(process.cwd(), 'plantillas')
      : path.join(process.cwd(), 'PLANTILLAS');

    const rucPath = path.join(plantillasDir, rucFileName);
    if (fs.existsSync(rucPath)) {
      const rucBuf = fs.readFileSync(rucPath);
      zip.file(rucZipLabel, rucBuf);
    }

    // 4. eBay Invoice PDF
    const invoicePath = path.join(
      plantillasDir,
      'Apple iPad Pro de 10,5 pulgadas - 256 GB - Wi-Fi Manchas blancas en la pantalla LCD.pdf'
    );
    if (fs.existsSync(invoicePath)) {
      const invoiceBuf = fs.readFileSync(invoicePath);
      zip.file(`4_EBAY_INVOICE_ORDEN_COMPRA.pdf`, invoiceBuf);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipFilename = `EXPEDIENTE_SHIPER_${dateStr}.zip`;

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
      },
    });
  } catch (error) {
    console.error('Error generando expediente ZIP para Shipper:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar expediente ZIP' },
      { status: 500 }
    );
  }
}
