import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { syncAllDbProductsToExcel } from "@/lib/excel-compras-writer";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser.tenantId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const result = await syncAllDbProductsToExcel(currentUser.tenantId);

    const parts: string[] = [];
    if (result.addedToFabio > 0) parts.push(`${result.addedToFabio} compras agregadas a Excel Fabio`);
    if (result.addedToLiliana > 0) parts.push(`${result.addedToLiliana} compras agregadas a Excel Liliana`);
    if (result.updatedFabio > 0) parts.push(`${result.updatedFabio} trackings actualizados en Fabio`);
    if (result.updatedLiliana > 0) parts.push(`${result.updatedLiliana} trackings actualizados en Liliana`);

    const summaryMsg =
      parts.length > 0
        ? `Sincronización con Excel completada: ${parts.join(', ')} (${result.alreadyExists} ya existentes).`
        : `Todos los archivos Excel de Fabio y Liliana están al día (${result.alreadyExists} compras verificadas sin faltantes).`;

    return NextResponse.json({
      success: true,
      message: summaryMsg,
      result,
    });
  } catch (error: any) {
    console.error("Error in compras/sync-to-excel:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error al sincronizar las compras con los archivos Excel",
      },
      { status: 500 }
    );
  }
}
