import { NextResponse } from "next/server";
import { type BookingStatus, bookingStatuses } from "@/lib/rental-data";
import {
  AdminAuthError,
  adminUnauthorizedResponse,
  requireAdminSession,
} from "@/lib/admin-auth";
import {
  type BookingDetailsInput,
  RentalDbError,
  updateBookingDetails,
  updateBookingStatus,
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
    const booking = isStatusOnlyPayload(body)
      ? updateBookingStatus(id, parseStatusPayload(body))
      : updateBookingDetails(id, parseBookingDetailsPayload(body));

    return NextResponse.json({ booking });
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
      { error: "No se pudo actualizar la reserva." },
      { status: 500 },
    );
  }
}

function isStatusOnlyPayload(body: unknown) {
  if (!body || typeof body !== "object") {
    return false;
  }

  const payload = body as {
    customer?: unknown;
    start?: unknown;
    end?: unknown;
    items?: unknown;
    status?: unknown;
  };

  return (
    typeof payload.status === "string" &&
    payload.customer === undefined &&
    payload.start === undefined &&
    payload.end === undefined &&
    payload.items === undefined
  );
}

function parseStatusPayload(body: unknown): BookingStatus {
  if (!body || typeof body !== "object") {
    throw new RentalDbError("INVALID_BODY", "El pedido no es valido.");
  }

  const payload = body as { status?: unknown };

  if (
    typeof payload.status !== "string" ||
    !bookingStatuses.includes(payload.status as BookingStatus)
  ) {
    throw new RentalDbError("INVALID_STATUS", "El estado no es valido.");
  }

  return payload.status as BookingStatus;
}

function parseBookingDetailsPayload(body: unknown): BookingDetailsInput {
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
