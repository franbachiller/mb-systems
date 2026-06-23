import { NextResponse } from "next/server";
import {
  inventoryBlockReasons,
  type InventoryBlockReason,
} from "@/lib/rental-data";
import {
  AdminAuthError,
  adminUnauthorizedResponse,
  requireAdminSession,
} from "@/lib/admin-auth";
import {
  createInventoryBlock,
  type InventoryBlockInput,
  listInventoryBlocks,
  RentalDbError,
} from "@/lib/rental-db";
import { requireSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminSession();

    return NextResponse.json({ blocks: listInventoryBlocks() });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return adminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: "No se pudieron cargar los bloqueos." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const originError = requireSameOriginRequest(request);

    if (originError) {
      return originError;
    }

    await requireAdminSession();

    const body = (await request.json()) as unknown;
    const block = createInventoryBlock(parseInventoryBlockPayload(body));

    return NextResponse.json({ block }, { status: 201 });
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
      { error: "No se pudo crear el bloqueo." },
      { status: 500 },
    );
  }
}

function parseInventoryBlockPayload(body: unknown): InventoryBlockInput {
  if (!body || typeof body !== "object") {
    throw new RentalDbError("INVALID_BODY", "El pedido no es valido.");
  }

  const payload = body as {
    productId?: unknown;
    quantity?: unknown;
    start?: unknown;
    end?: unknown;
    reason?: unknown;
    note?: unknown;
  };

  if (
    typeof payload.productId !== "string" ||
    typeof payload.start !== "string" ||
    typeof payload.end !== "string" ||
    typeof payload.reason !== "string" ||
    !inventoryBlockReasons.includes(payload.reason as InventoryBlockReason)
  ) {
    throw new RentalDbError(
      "INVALID_BLOCK",
      "Los datos del bloqueo no son validos.",
    );
  }

  return {
    productId: payload.productId,
    quantity:
      typeof payload.quantity === "number" ? payload.quantity : Number.NaN,
    window: {
      start: payload.start,
      end: payload.end,
    },
    reason: payload.reason as InventoryBlockReason,
    note: typeof payload.note === "string" ? payload.note : "",
  };
}
