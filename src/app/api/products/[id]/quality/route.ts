import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/products/[id]/quality - Get quality checks for a product
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await db.product.findUnique({ where: { id } });

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    const qualityChecks = await db.qualityCheck.findMany({
      where: { productId: id },
      orderBy: { checkedAt: "desc" },
    });

    // Map to frontend format
    const mapped = qualityChecks.map((qc) => ({
      id: qc.id,
      productId: qc.productId,
      inspectorName: qc.inspector,
      notes: qc.notes,
      checks: {
        screenOk: qc.screenOk,
        touchOk: qc.touchscreenOk,
        speakersOk: qc.speakersOk,
        microphoneOk: qc.microphoneOk,
        wifiOk: qc.wifiOk,
        bluetoothOk: qc.bluetoothOk,
        camerasOk: qc.cameraOk,
        portsOk: qc.portsOk,
        buttonsOk: qc.buttonsOk,
        keyboardOk: qc.keyboardOk,
        trackpadOk: qc.trackpadOk,
        chassisOk: qc.housingOk,
        batteryOk: qc.batteryOk,
        chargerIncluded: qc.chargerIncluded,
        originalBox: qc.originalBox,
      },
      createdAt: qc.checkedAt.toISOString(),
    }));

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Error fetching quality checks:", error);
    return NextResponse.json(
      { error: "Error al obtener los controles de calidad" },
      { status: 500 }
    );
  }
}

// POST /api/products/[id]/quality - Create quality check for a product
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Frontend sends: { inspectorName, notes, checks: { screenOk, touchOk, ... } }
    const { inspectorName, notes, checks } = body;

    // Verify product exists
    const product = await db.product.findUnique({ where: { id } });

    if (!product) {
      return NextResponse.json(
        { error: "Producto no encontrado" },
        { status: 404 }
      );
    }

    // Calculate pass: all checks must be true (except chargerIncluded and originalBox which are optional)
    const coreChecks = [
      checks?.screenOk, checks?.touchOk, checks?.speakersOk,
      checks?.microphoneOk, checks?.wifiOk, checks?.bluetoothOk,
      checks?.camerasOk, checks?.portsOk, checks?.buttonsOk,
      checks?.keyboardOk, checks?.trackpadOk, checks?.chassisOk,
      checks?.batteryOk,
    ];
    const passed = coreChecks.every(Boolean);

    // Create quality check
    const qualityCheck = await db.qualityCheck.create({
      data: {
        productId: id,
        screenOk: checks?.screenOk ?? false,
        touchscreenOk: checks?.touchOk ?? false,
        buttonsOk: checks?.buttonsOk ?? false,
        speakersOk: checks?.speakersOk ?? false,
        microphoneOk: checks?.microphoneOk ?? false,
        cameraOk: checks?.camerasOk ?? false,
        portsOk: checks?.portsOk ?? false,
        wifiOk: checks?.wifiOk ?? false,
        bluetoothOk: checks?.bluetoothOk ?? false,
        keyboardOk: checks?.keyboardOk ?? false,
        trackpadOk: checks?.trackpadOk ?? false,
        housingOk: checks?.chassisOk ?? false,
        batteryOk: checks?.batteryOk ?? false,
        chargerIncluded: checks?.chargerIncluded ?? false,
        originalBox: checks?.originalBox ?? false,
        passed,
        inspector: inspectorName || "",
        notes: notes || "",
      },
    });

    // Update product's quality passed field
    await db.product.update({
      where: { id },
      data: {
        qualityPassed: passed,
        qualityNotes: notes || "",
      },
    });

    // Return in frontend format
    return NextResponse.json({
      id: qualityCheck.id,
      productId: qualityCheck.productId,
      inspectorName: qualityCheck.inspector,
      notes: qualityCheck.notes,
      checks: {
        screenOk: qualityCheck.screenOk,
        touchOk: qualityCheck.touchscreenOk,
        speakersOk: qualityCheck.speakersOk,
        microphoneOk: qualityCheck.microphoneOk,
        wifiOk: qualityCheck.wifiOk,
        bluetoothOk: qualityCheck.bluetoothOk,
        camerasOk: qualityCheck.cameraOk,
        portsOk: qualityCheck.portsOk,
        buttonsOk: qualityCheck.buttonsOk,
        keyboardOk: qualityCheck.keyboardOk,
        trackpadOk: qualityCheck.trackpadOk,
        chassisOk: qualityCheck.housingOk,
        batteryOk: qualityCheck.batteryOk,
        chargerIncluded: qualityCheck.chargerIncluded,
        originalBox: qualityCheck.originalBox,
      },
      createdAt: qualityCheck.checkedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating quality check:", error);
    return NextResponse.json(
      { error: "Error al crear el control de calidad" },
      { status: 500 }
    );
  }
}
