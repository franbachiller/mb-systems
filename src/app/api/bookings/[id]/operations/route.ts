import { NextResponse } from "next/server";
import {
  bookingOperationStages,
  type BookingOperationStage,
} from "@/lib/rental-data";
import {
  AdminAuthError,
  adminUnauthorizedResponse,
  requireAdminSession,
} from "@/lib/admin-auth";
import { recordBookingOperation, RentalDbError } from "@/lib/rental-db";
import { requireSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const originError = requireSameOriginRequest(request);

    if (originError) {
      return originError;
    }

    await requireAdminSession();

    const { id } = await context.params;
    const body = (await request.json()) as unknown;
    const operation = parseOperationPayload(body);
    const booking = recordBookingOperation(id, operation);

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return adminUnauthorizedResponse();
    }

    if (error instanceof RentalDbError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "No se pudo registrar la operacion." },
      { status: 500 },
    );
  }
}

function parseOperationPayload(body: unknown): {
  stage: BookingOperationStage;
  equipmentChecked: boolean;
  accessoriesChecked: boolean;
  powerChecked: boolean;
  conditionNotes?: string;
  damageFee: number;
  missingFee: number;
} {
  if (!body || typeof body !== "object") {
    throw new RentalDbError("INVALID_BODY", "El pedido no es valido.");
  }

  const payload = body as {
    stage?: unknown;
    equipmentChecked?: unknown;
    accessoriesChecked?: unknown;
    powerChecked?: unknown;
    conditionNotes?: unknown;
    damageFee?: unknown;
    missingFee?: unknown;
  };

  if (
    typeof payload.stage !== "string" ||
    !bookingOperationStages.includes(payload.stage as BookingOperationStage)
  ) {
    throw new RentalDbError("INVALID_OPERATION_STAGE", "La operacion no es valida.");
  }

  if (
    typeof payload.equipmentChecked !== "boolean" ||
    typeof payload.accessoriesChecked !== "boolean" ||
    typeof payload.powerChecked !== "boolean"
  ) {
    throw new RentalDbError("INVALID_CHECKLIST", "El checklist no es valido.");
  }

  if (
    payload.conditionNotes !== undefined &&
    payload.conditionNotes !== null &&
    typeof payload.conditionNotes !== "string"
  ) {
    throw new RentalDbError("INVALID_NOTES", "La nota no es valida.");
  }

  if (
    typeof payload.damageFee !== "number" ||
    !Number.isInteger(payload.damageFee) ||
    payload.damageFee < 0 ||
    typeof payload.missingFee !== "number" ||
    !Number.isInteger(payload.missingFee) ||
    payload.missingFee < 0
  ) {
    throw new RentalDbError(
      "INVALID_CHARGE_AMOUNT",
      "El cargo debe ser un numero entero positivo.",
    );
  }

  return {
    stage: payload.stage as BookingOperationStage,
    equipmentChecked: payload.equipmentChecked,
    accessoriesChecked: payload.accessoriesChecked,
    powerChecked: payload.powerChecked,
    conditionNotes:
      typeof payload.conditionNotes === "string"
        ? payload.conditionNotes.trim()
        : undefined,
    damageFee: payload.damageFee,
    missingFee: payload.missingFee,
  };
}
