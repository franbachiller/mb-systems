import { NextResponse } from "next/server";
import { paymentMethods, type PaymentMethod } from "@/lib/rental-data";
import {
  AdminAuthError,
  adminUnauthorizedResponse,
  requireAdminSession,
} from "@/lib/admin-auth";
import { recordBookingPayment, RentalDbError } from "@/lib/rental-db";
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
    const payment = parsePaymentPayload(body);
    const booking = recordBookingPayment(id, payment);

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
      { error: "No se pudo registrar el pago." },
      { status: 500 },
    );
  }
}

function parsePaymentPayload(body: unknown): {
  amount: number;
  method: PaymentMethod;
  note?: string;
} {
  if (!body || typeof body !== "object") {
    throw new RentalDbError("INVALID_BODY", "El pedido no es valido.");
  }

  const payload = body as {
    amount?: unknown;
    method?: unknown;
    note?: unknown;
  };

  if (
    typeof payload.amount !== "number" ||
    !Number.isInteger(payload.amount) ||
    payload.amount <= 0
  ) {
    throw new RentalDbError(
      "INVALID_PAYMENT_AMOUNT",
      "El pago debe ser un numero entero mayor a cero.",
    );
  }

  if (
    typeof payload.method !== "string" ||
    !paymentMethods.includes(payload.method as PaymentMethod)
  ) {
    throw new RentalDbError("INVALID_PAYMENT_METHOD", "El metodo no es valido.");
  }

  if (
    payload.note !== undefined &&
    payload.note !== null &&
    typeof payload.note !== "string"
  ) {
    throw new RentalDbError("INVALID_NOTE", "La nota no es valida.");
  }

  return {
    amount: payload.amount,
    method: payload.method as PaymentMethod,
    note: typeof payload.note === "string" ? payload.note.trim() : undefined,
  };
}
