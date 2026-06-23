import { NextResponse } from "next/server";
import {
  createMercadoPagoPreference,
  getMercadoPagoCheckoutUrl,
  getMercadoPagoPublicStatus,
  MercadoPagoError,
} from "@/lib/mercado-pago";
import {
  getAdminBookingForPublicPayment,
  RentalDbError,
} from "@/lib/rental-db";
import {
  rateLimitRequest,
  requireSameOriginRequest,
} from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentMode = "deposit" | "balance";

export async function GET() {
  return NextResponse.json(getMercadoPagoPublicStatus());
}

export async function POST(request: Request) {
  try {
    const originError = requireSameOriginRequest(request);

    if (originError) {
      return originError;
    }

    const rateLimitError = rateLimitRequest(request, {
      key: "mercadopago-preference",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimitError) {
      return rateLimitError;
    }

    const body = (await request.json()) as unknown;
    const payload = parsePreferencePayload(body);
    const booking = getAdminBookingForPublicPayment({
      bookingId: payload.bookingId,
      phone: payload.phone,
    });

    if (booking.status === "cancelado") {
      throw new RentalDbError(
        "BOOKING_CANCELED",
        "No se puede pagar una reserva cancelada.",
      );
    }

    if (booking.balanceDue <= 0) {
      throw new RentalDbError(
        "BOOKING_PAID",
        "La reserva no tiene saldo pendiente.",
      );
    }

    const preference = await createMercadoPagoPreference({
      booking,
      amount: getPaymentAmount(booking, payload.mode),
      origin: getApplicationOrigin(request),
    });

    return NextResponse.json({
      preferenceId: preference.id,
      checkoutUrl: getMercadoPagoCheckoutUrl(preference),
      amount: preference.amount,
      sandbox: getMercadoPagoPublicStatus().sandbox,
    });
  } catch (error) {
    if (error instanceof RentalDbError || error instanceof MercadoPagoError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "MERCADO_PAGO_NOT_CONFIGURED" ? 503 : 400 },
      );
    }

    return NextResponse.json(
      { error: "No se pudo crear el link de pago." },
      { status: 500 },
    );
  }
}

function parsePreferencePayload(body: unknown): {
  bookingId: string;
  phone: string;
  mode: PaymentMode;
} {
  if (!body || typeof body !== "object") {
    throw new RentalDbError("INVALID_BODY", "El pedido no es valido.");
  }

  const payload = body as {
    bookingId?: unknown;
    phone?: unknown;
    mode?: unknown;
  };

  return {
    bookingId: typeof payload.bookingId === "string" ? payload.bookingId : "",
    phone: typeof payload.phone === "string" ? payload.phone : "",
    mode: payload.mode === "balance" ? "balance" : "deposit",
  };
}

function getPaymentAmount(
  booking: { deposit: number; paidTotal: number; balanceDue: number },
  mode: PaymentMode,
) {
  if (mode === "balance") {
    return booking.balanceDue;
  }

  const remainingDeposit = Math.max(0, booking.deposit - booking.paidTotal);

  return Math.min(remainingDeposit > 0 ? remainingDeposit : booking.balanceDue, booking.balanceDue);
}

function getApplicationOrigin(request: Request) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/g, "");
  }

  return new URL(request.url).origin;
}
