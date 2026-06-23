import "server-only";

import type { AdminBooking } from "@/lib/rental-data";

const mercadoPagoApiBase = "https://api.mercadopago.com";

export type MercadoPagoPreference = {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
  amount: number;
};

export type MercadoPagoPayment = {
  id: string;
  status: string;
  statusDetail: string | null;
  externalReference: string;
  transactionAmount: number;
  totalPaidAmount: number;
  paymentMethodId: string | null;
  paymentTypeId: string | null;
};

type MercadoPagoPreferenceResponse = {
  id?: unknown;
  init_point?: unknown;
  sandbox_init_point?: unknown;
};

type MercadoPagoPaymentResponse = {
  id?: unknown;
  status?: unknown;
  status_detail?: unknown;
  external_reference?: unknown;
  transaction_amount?: unknown;
  payment_method_id?: unknown;
  payment_type_id?: unknown;
  transaction_details?: {
    total_paid_amount?: unknown;
  };
};

export class MercadoPagoError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

export function isMercadoPagoConfigured() {
  return getMercadoPagoAccessToken() !== "";
}

export function getMercadoPagoPublicStatus() {
  return {
    enabled: isMercadoPagoConfigured(),
    sandbox: isMercadoPagoSandbox(),
  };
}

export async function createMercadoPagoPreference(input: {
  booking: AdminBooking;
  amount: number;
  origin: string;
}) {
  const accessToken = requireMercadoPagoAccessToken();
  const amount = normalizePaymentAmount(input.amount);
  const preferencePayload = {
    items: [
      {
        id: input.booking.id,
        title: `Reserva ${input.booking.id} - MB Systems`,
        description: formatItems(input.booking),
        quantity: 1,
        currency_id: "ARS",
        unit_price: amount,
      },
    ],
    payer: {
      name: input.booking.clientName,
      email: input.booking.clientEmail ?? undefined,
      phone: input.booking.clientPhone
        ? { number: input.booking.clientPhone }
        : undefined,
    },
    back_urls: {
      success: `${input.origin}/reservas?id=${encodeURIComponent(input.booking.id)}`,
      pending: `${input.origin}/reservas?id=${encodeURIComponent(input.booking.id)}`,
      failure: `${input.origin}/reservas?id=${encodeURIComponent(input.booking.id)}`,
    },
    notification_url: `${input.origin}/api/mercadopago/webhook`,
    external_reference: input.booking.id,
    statement_descriptor: "MB SYSTEMS",
    metadata: {
      booking_id: input.booking.id,
    },
  };
  const response = await fetch(`${mercadoPagoApiBase}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preferencePayload),
  });
  const data = (await response.json().catch(() => ({}))) as
    | MercadoPagoPreferenceResponse
    | { message?: string; error?: string };

  if (!response.ok) {
    throw new MercadoPagoError(
      "PREFERENCE_CREATE_FAILED",
      getMercadoPagoErrorMessage(data, "No se pudo crear el link de pago."),
    );
  }

  const preferenceData = data as MercadoPagoPreferenceResponse;

  if (
    typeof preferenceData.id !== "string" ||
    typeof preferenceData.init_point !== "string" ||
    typeof preferenceData.sandbox_init_point !== "string"
  ) {
    throw new MercadoPagoError(
      "INVALID_PREFERENCE_RESPONSE",
      "Mercado Pago devolvio una preferencia invalida.",
    );
  }

  return {
    id: preferenceData.id,
    initPoint: preferenceData.init_point,
    sandboxInitPoint: preferenceData.sandbox_init_point,
    amount,
  } satisfies MercadoPagoPreference;
}

export async function getMercadoPagoPayment(paymentId: string) {
  const accessToken = requireMercadoPagoAccessToken();
  const id = paymentId.trim();

  if (!id) {
    throw new MercadoPagoError("INVALID_PAYMENT_ID", "El pago no es valido.");
  }

  const response = await fetch(
    `${mercadoPagoApiBase}/v1/payments/${encodeURIComponent(id)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );
  const data = (await response.json().catch(() => ({}))) as
    | MercadoPagoPaymentResponse
    | { message?: string; error?: string };

  if (!response.ok) {
    throw new MercadoPagoError(
      "PAYMENT_FETCH_FAILED",
      getMercadoPagoErrorMessage(data, "No se pudo consultar el pago."),
    );
  }

  return parseMercadoPagoPayment(data as MercadoPagoPaymentResponse);
}

export function getMercadoPagoCheckoutUrl(preference: MercadoPagoPreference) {
  const checkoutUrl = isMercadoPagoSandbox()
    ? preference.sandboxInitPoint
    : preference.initPoint;

  if (!isAllowedMercadoPagoCheckoutUrl(checkoutUrl)) {
    throw new MercadoPagoError(
      "INVALID_CHECKOUT_URL",
      "Mercado Pago devolvio un link de pago invalido.",
    );
  }

  return checkoutUrl;
}

function parseMercadoPagoPayment(
  data: MercadoPagoPaymentResponse,
): MercadoPagoPayment {
  if (
    typeof data.id !== "number" &&
    typeof data.id !== "string"
  ) {
    throw new MercadoPagoError(
      "INVALID_PAYMENT_RESPONSE",
      "Mercado Pago devolvio un pago invalido.",
    );
  }

  const transactionAmount = Number(data.transaction_amount);
  const totalPaidAmount = Number(data.transaction_details?.total_paid_amount);

  return {
    id: String(data.id),
    status: typeof data.status === "string" ? data.status : "",
    statusDetail:
      typeof data.status_detail === "string" ? data.status_detail : null,
    externalReference:
      typeof data.external_reference === "string" ? data.external_reference : "",
    transactionAmount: Number.isFinite(transactionAmount) ? transactionAmount : 0,
    totalPaidAmount: Number.isFinite(totalPaidAmount)
      ? totalPaidAmount
      : Number.isFinite(transactionAmount)
        ? transactionAmount
        : 0,
    paymentMethodId:
      typeof data.payment_method_id === "string"
        ? data.payment_method_id
        : null,
    paymentTypeId:
      typeof data.payment_type_id === "string" ? data.payment_type_id : null,
  };
}

function getMercadoPagoAccessToken() {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ?? "";
}

function requireMercadoPagoAccessToken() {
  const accessToken = getMercadoPagoAccessToken();

  if (!accessToken) {
    throw new MercadoPagoError(
      "MERCADO_PAGO_NOT_CONFIGURED",
      "Falta configurar MERCADO_PAGO_ACCESS_TOKEN.",
    );
  }

  return accessToken;
}

function isMercadoPagoSandbox() {
  const mode = process.env.MERCADO_PAGO_ENV?.trim().toLowerCase();

  return (
    mode === "sandbox" ||
    process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim().startsWith("TEST-") === true
  );
}

function isAllowedMercadoPagoCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    return (
      url.protocol === "https:" &&
      (hostname === "www.mercadopago.com.ar" ||
        hostname === "mercadopago.com.ar" ||
        hostname.endsWith(".mercadopago.com.ar") ||
        hostname === "www.mercadopago.com" ||
        hostname.endsWith(".mercadopago.com"))
    );
  } catch {
    return false;
  }
}

function normalizePaymentAmount(value: number) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new MercadoPagoError(
      "INVALID_PAYMENT_AMOUNT",
      "El importe a pagar no es valido.",
    );
  }

  return value;
}

function formatItems(booking: AdminBooking) {
  return booking.items
    .map((item) => `${item.quantity} x ${item.productName}`)
    .join(", ");
}

function getMercadoPagoErrorMessage(
  data: unknown,
  fallback: string,
) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const payload = data as { message?: unknown; error?: unknown };

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (typeof payload.error === "string") {
    return payload.error;
  }

  return fallback;
}
