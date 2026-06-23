import { NextResponse } from "next/server";
import { type Product } from "@/lib/rental-data";
import {
  AdminAuthError,
  adminUnauthorizedResponse,
  requireAdminSession,
} from "@/lib/admin-auth";
import {
  type ProductCatalogInput,
  RentalDbError,
  updateProductCatalogItem,
} from "@/lib/rental-db";
import { requireSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const originError = requireSameOriginRequest(request);

    if (originError) {
      return originError;
    }

    await requireAdminSession();

    const { id } = await context.params;
    const body = (await request.json()) as unknown;
    const product = updateProductCatalogItem(id, parseProductPayload(body));

    return NextResponse.json({ product });
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
      { error: "No se pudo actualizar el equipo." },
      { status: 500 },
    );
  }
}

function parseProductPayload(body: unknown): ProductCatalogInput {
  if (!body || typeof body !== "object") {
    throw new RentalDbError("INVALID_BODY", "El pedido no es valido.");
  }

  const payload = body as {
    name?: unknown;
    category?: unknown;
    totalUnits?: unknown;
    maintenanceUnits?: unknown;
    pricePerDay?: unknown;
    imageUrl?: unknown;
    specs?: unknown;
    tags?: unknown;
  };

  if (
    typeof payload.name !== "string" ||
    typeof payload.category !== "string" ||
    typeof payload.imageUrl !== "string" ||
    typeof payload.specs !== "string" ||
    !Array.isArray(payload.tags) ||
    !payload.tags.every((tag) => typeof tag === "string")
  ) {
    throw new RentalDbError("INVALID_PRODUCT", "Los datos del equipo no son validos.");
  }

  return {
    name: payload.name,
    category: payload.category as Product["category"],
    totalUnits:
      typeof payload.totalUnits === "number" ? payload.totalUnits : Number.NaN,
    maintenanceUnits:
      typeof payload.maintenanceUnits === "number"
        ? payload.maintenanceUnits
        : Number.NaN,
    pricePerDay:
      typeof payload.pricePerDay === "number" ? payload.pricePerDay : Number.NaN,
    imageUrl: payload.imageUrl,
    specs: payload.specs,
    tags: payload.tags,
  };
}
