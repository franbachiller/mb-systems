import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  getMercadoPagoPayment,
  MercadoPagoError,
} from "@/lib/mercado-pago";
import {
  recordExternalBookingPayment,
  RentalDbError,
} from "@/lib/rental-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoWebhookBody = {
  type?: unknown;
  action?: unknown;
  data?: {
    id?: unknown;
  };
};

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as MercadoPagoWebhookBody;
  const eventType = getWebhookType(url, body);
  const paymentId = getWebhookPaymentId(url, body);

  if (eventType !== "payment" || !paymentId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  if (!isWebhookSignatureValid(request.headers, url)) {
    return NextResponse.json(
      { error: "Firma de Mercado Pago invalida." },
      { status: 401 },
    );
  }

  try {
    const payment = await getMercadoPagoPayment(paymentId);

    if (payment.status !== "approved" || !payment.externalReference) {
      return NextResponse.json({ received: true, ignored: true });
    }

    recordExternalBookingPayment(payment.externalReference, {
      provider: "mercadopago",
      externalPaymentId: payment.id,
      amount: Math.round(payment.transactionAmount),
      method: "mercadopago",
      note: buildPaymentNote(payment),
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    if (
      error instanceof RentalDbError &&
      (error.code === "BOOKING_NOT_FOUND" ||
        error.code === "PAYMENT_EXCEEDS_BALANCE")
    ) {
      return NextResponse.json({ received: true, ignored: true });
    }

    if (error instanceof MercadoPagoError || error instanceof RentalDbError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "No se pudo procesar el webhook." },
      { status: 500 },
    );
  }
}

function getWebhookType(url: URL, body: MercadoPagoWebhookBody) {
  const queryType = url.searchParams.get("type");

  if (queryType) {
    return queryType;
  }

  return typeof body.type === "string" ? body.type : "";
}

function getWebhookPaymentId(url: URL, body: MercadoPagoWebhookBody) {
  const queryPaymentId = url.searchParams.get("data.id");

  if (queryPaymentId) {
    return queryPaymentId;
  }

  return typeof body.data?.id === "string" || typeof body.data?.id === "number"
    ? String(body.data.id)
    : "";
}

function isWebhookSignatureValid(headers: Headers, url: URL) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const signatureHeader = headers.get("x-signature");
  const requestId = headers.get("x-request-id");

  if (!signatureHeader) {
    return false;
  }

  const signatureParts = new Map(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=", 2);

      return [key?.trim(), value?.trim()];
    }),
  );
  const timestamp = signatureParts.get("ts");
  const receivedSignature = signatureParts.get("v1");

  if (!timestamp || !receivedSignature) {
    return false;
  }

  const manifest = [
    url.searchParams.get("data.id")
      ? `id:${url.searchParams.get("data.id")};`
      : "",
    requestId ? `request-id:${requestId};` : "",
    `ts:${timestamp};`,
  ].join("");
  const expectedSignature = createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return safeEqual(receivedSignature, expectedSignature);
}

function safeEqual(firstValue: string, secondValue: string) {
  const firstBuffer = Buffer.from(firstValue);
  const secondBuffer = Buffer.from(secondValue);

  return (
    firstBuffer.length === secondBuffer.length &&
    timingSafeEqual(firstBuffer, secondBuffer)
  );
}

function buildPaymentNote(payment: {
  id: string;
  paymentMethodId: string | null;
  paymentTypeId: string | null;
  statusDetail: string | null;
}) {
  return [
    `Mercado Pago ${payment.id}`,
    payment.paymentMethodId ? `medio ${payment.paymentMethodId}` : "",
    payment.paymentTypeId ? `tipo ${payment.paymentTypeId}` : "",
    payment.statusDetail ? `detalle ${payment.statusDetail}` : "",
  ]
    .filter(Boolean)
    .join(" - ");
}
