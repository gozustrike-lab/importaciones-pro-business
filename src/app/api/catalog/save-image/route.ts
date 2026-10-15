import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// POST /api/catalog/save-image
// Body: { modelKey: string, slot: number (1, 2, 3), imageUrl: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelKey, slot, imageUrl } = body;

    if (!modelKey || !slot || !imageUrl) {
      return NextResponse.json(
        { error: "Faltan parámetros: modelKey, slot, imageUrl" },
        { status: 400 }
      );
    }

    const safeSlot = Math.min(Math.max(Number(slot), 1), 3);
    const targetDir = path.join(process.cwd(), "public", "catalog");
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const fileName = `${modelKey}-${safeSlot}.png`;
    const destPath = path.join(targetDir, fileName);

    const res = await fetch(imageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `No se pudo descargar la imagen (HTTP ${res.status})` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 3000) {
      return NextResponse.json(
        { error: "La imagen es demasiado pequeña o inválida" },
        { status: 400 }
      );
    }

    fs.writeFileSync(destPath, buffer);

    // If slot is 1, also copy to default key.png
    if (safeSlot === 1) {
      fs.copyFileSync(destPath, path.join(targetDir, `${modelKey}.png`));
    }

    return NextResponse.json({
      success: true,
      fileName,
      path: `/catalog/${fileName}?t=${Date.now()}`,
      sizeKb: Math.round(buffer.length / 1024),
    });
  } catch (error: unknown) {
    console.error("Error saving catalog image:", error);
    const message = error instanceof Error ? error.message : "Error al guardar imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
