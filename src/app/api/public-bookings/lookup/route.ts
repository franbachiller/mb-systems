import { NextResponse } from "next/server";
import { lookupPublicBooking, RentalDbError } from "@/lib/rental-db";
import {
  rateLimitRequest,
  requireSameOriginRequest,
} from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const originError = requireSameOriginRequest(request);

    if (originError) {
      return originError;
    }

    const rateLimitError = rateLimitRequest(request, {
      key: "public-booking-lookup",
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimitError) {
      return rateLimitError;
    }

    const body = (await request.json()) as unknown;
    const booking = lookupPublicBooking(parseLookupPayload(body));

    return NextResponse.json({ booking });
  } catch (error) {
    if (error instanceof RentalDbError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.code === "BOOKING_NOT_FOUND" ? 404 : 400 },
      );
    }

    return NextResponse.json(
      { error: "No se pudo consultar la reserva." },
      { status: 500 },
    );
  }
}

function parseLookupPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new RentalDbError("INVALID_BODY", "El pedido no es valido.");
  }

  const payload = body as {
    bookingId?: unknown;
    phone?: unknown;
  };

  return {
    bookingId:
      typeof payload.bookingId === "string" ? payload.bookingId.trim() : "",
    phone: typeof payload.phone === "string" ? payload.phone.trim() : "",
  };
}
