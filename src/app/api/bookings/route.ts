import { NextResponse } from "next/server";
import {
  AdminAuthError,
  adminUnauthorizedResponse,
  requireAdminSession,
} from "@/lib/admin-auth";
import {
  createBooking,
  listAdminBookings,
  RentalDbError,
} from "@/lib/rental-db";
import {
  rateLimitRequest,
  requireSameOriginRequest,
} from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminSession();

    return NextResponse.json({ bookings: listAdminBookings() });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return adminUnauthorizedResponse();
    }

    return NextResponse.json(
      { error: "No se pudieron cargar las reservas." },
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

    const rateLimitError = rateLimitRequest(request, {
      key: "public-booking-create",
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });

    if (rateLimitError) {
      return rateLimitError;
    }

    const body = (await request.json()) as unknown;
    const booking = createBooking(parseBookingPayload(body));

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    if (error instanceof RentalDbError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "No se pudo crear la reserva." },
      { status: 500 },
    );
  }
}

function parseBookingPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    throw new RentalDbError("INVALID_BODY", "El pedido no es valido.");
  }

  const payload = body as {
    customer?: {
      name?: unknown;
      phone?: unknown;
      email?: unknown;
    };
    start?: unknown;
    end?: unknown;
    items?: unknown;
  };

  if (!Array.isArray(payload.items)) {
    throw new RentalDbError("INVALID_ITEMS", "El pedido no tiene items validos.");
  }

  return {
    customer: {
      name: typeof payload.customer?.name === "string" ? payload.customer.name : "",
      phone:
        typeof payload.customer?.phone === "string" ? payload.customer.phone : "",
      email:
        typeof payload.customer?.email === "string" ? payload.customer.email : "",
    },
    window: {
      start: typeof payload.start === "string" ? payload.start : "",
      end: typeof payload.end === "string" ? payload.end : "",
    },
    items: payload.items.map((item) => {
      if (!item || typeof item !== "object") {
        return { productId: "", quantity: 0 };
      }

      const itemPayload = item as {
        productId?: unknown;
        quantity?: unknown;
      };

      return {
        productId:
          typeof itemPayload.productId === "string" ? itemPayload.productId : "",
        quantity:
          typeof itemPayload.quantity === "number" ? itemPayload.quantity : 0,
      };
    }),
  };
}
