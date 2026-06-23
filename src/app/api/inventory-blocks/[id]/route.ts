import { NextResponse } from "next/server";
import {
  AdminAuthError,
  adminUnauthorizedResponse,
  requireAdminSession,
} from "@/lib/admin-auth";
import { deleteInventoryBlock, RentalDbError } from "@/lib/rental-db";
import { requireSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const originError = requireSameOriginRequest(request);

    if (originError) {
      return originError;
    }

    await requireAdminSession();

    const { id } = await context.params;
    const block = deleteInventoryBlock(id);

    return NextResponse.json({ block });
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
      { error: "No se pudo eliminar el bloqueo." },
      { status: 500 },
    );
  }
}
