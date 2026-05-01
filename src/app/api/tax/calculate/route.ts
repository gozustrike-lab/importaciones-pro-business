import { NextRequest, NextResponse } from "next/server";
import { calculateTaxes } from "@/lib/business-logic";

// POST /api/tax/calculate - Calculate taxes for a given purchase
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fobUSD, shippingUSD, exchangeRate } = body;

    if (fobUSD === undefined || fobUSD === null) {
      return NextResponse.json(
        { error: "El campo 'fobUSD' es obligatorio" },
        { status: 400 }
      );
    }

    const result = calculateTaxes(
      fobUSD,
      shippingUSD || 0,
      exchangeRate || 3.7
    );

    return NextResponse.json({
      fobUSD: result.fob,
      shippingUSD,
      exchangeRate,
      fobPEN: Math.round(result.fob * exchangeRate * 100) / 100,
      adValorem: Math.round(result.adValoremUsd * exchangeRate * 100) / 100,
      baseIGV: Math.round(result.baseIgvUsd * exchangeRate * 100) / 100,
      igv: Math.round(result.igvUsd * exchangeRate * 100) / 100,
      percepcion: Math.round(result.perceptionUsd * exchangeRate * 100) / 100,
      totalTaxesUSD: Math.round(result.totalTaxUsd * 100) / 100,
      totalTaxesPEN: Math.round(result.totalTaxPen * 100) / 100,
      exempt: result.totalTaxUsd === 0,
    });
  } catch (error) {
    console.error("Error calculating taxes:", error);
    return NextResponse.json(
      { error: "Error al calcular los impuestos" },
      { status: 500 }
    );
  }
}
