import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profile = searchParams.get('profile') || 'fabio';

    const isPeggy = profile.toLowerCase() === 'peggy' || profile.toLowerCase() === 'liliana';
    const filename = isPeggy ? 'FICHA RUC LILIANA.pdf' : 'SUNAT - FICHA RUC FABIO.pdf';
    const downloadName = isPeggy
      ? 'SUNAT_FICHA_RUC_LILIANA_10091870911.pdf'
      : 'SUNAT_FICHA_RUC_FABIO_10762026835.pdf';

    const dir = fs.existsSync(path.join(process.cwd(), 'plantillas'))
      ? path.join(process.cwd(), 'plantillas')
      : path.join(process.cwd(), 'PLANTILLAS');
    const pdfPath = path.join(dir, filename);

    if (!fs.existsSync(pdfPath)) {
      return NextResponse.json({ error: `Archivo Ficha RUC no encontrado: ${filename}` }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(pdfPath);

    return new NextResponse(fileBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
      },
    });
  } catch (error) {
    console.error('Error sirviendo Ficha RUC:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener Ficha RUC' },
      { status: 500 }
    );
  }
}
