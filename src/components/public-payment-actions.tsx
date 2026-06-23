"use client";

import {
  CheckCircle2,
  Clipboard,
  Copy,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { useState } from "react";
import {
  buildPaymentNoticeMessage,
  buildWhatsAppHref,
  getBusinessWhatsAppPhone,
} from "@/lib/booking-messages";
import {
  getPublicPaymentOptions,
  hasPublicPaymentOptions,
} from "@/lib/payment-options";
import { savePublicPaymentLookupSession } from "@/lib/public-payment-session";

export type PaymentActionBooking = {
  id: string;
  clientName: string;
  deposit: number;
  totalDue: number;
  paidTotal: number;
  balanceDue: number;
};

type PaymentMode = "deposit" | "balance";

type MercadoPagoState =
  | { status: "idle" }
  | { status: "loading"; mode: PaymentMode }
  | { status: "error"; message: string };

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function PublicPaymentActions({
  booking,
  lookupPhone,
}: {
  booking: PaymentActionBooking;
  lookupPhone: string;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [mercadoPagoState, setMercadoPagoState] = useState<MercadoPagoState>({
    status: "idle",
  });
  const paymentOptions = getPublicPaymentOptions();
  const hasPaymentOptions = hasPublicPaymentOptions(paymentOptions);
  const suggestedPayment = getSuggestedPaymentAmount(booking);
  const canPayWithMercadoPago = lookupPhone.trim().length >= 3;
  const noticeHref = buildWhatsAppHref(
    getBusinessWhatsAppPhone(),
    buildPaymentNoticeMessage(booking),
  );

  async function copyValue(key: string, value: string) {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setCopiedKey(null);
    }
  }

  async function startMercadoPagoCheckout(mode: PaymentMode) {
    if (!canPayWithMercadoPago) {
      setMercadoPagoState({
        status: "error",
        message: "Ingresa el WhatsApp de la reserva para generar el pago.",
      });
      return;
    }

    setMercadoPagoState({ status: "loading", mode });

    try {
      const response = await fetch("/api/mercadopago/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          phone: lookupPhone,
          mode,
        }),
      });
      const data = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "No se pudo crear el link de pago.");
      }

      savePublicPaymentLookupSession({
        bookingId: booking.id,
        phone: lookupPhone,
      });
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      setMercadoPagoState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo crear el link de pago.",
      });
    }
  }

  if (booking.balanceDue <= 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          Reserva sin saldo pendiente.
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">Pago</p>
          <h3 className="text-lg font-semibold text-slate-950">
            Sena o saldo de reserva
          </h3>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-800">
          <Clipboard className="h-5 w-5" />
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <PaymentMetric
          label="Total"
          value={currencyFormatter.format(booking.totalDue)}
        />
        <PaymentMetric
          label="Sena sugerida"
          value={currencyFormatter.format(suggestedPayment)}
        />
        <PaymentMetric
          label="Saldo"
          value={currencyFormatter.format(booking.balanceDue)}
        />
      </div>

      {hasPaymentOptions ? (
        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          {paymentOptions.holder ? (
            <PaymentDataRow label="Titular" value={paymentOptions.holder} />
          ) : null}
          {paymentOptions.alias ? (
            <PaymentDataRow
              label="Alias"
              value={paymentOptions.alias}
              copied={copiedKey === "alias"}
              onCopy={() => void copyValue("alias", paymentOptions.alias)}
            />
          ) : null}
          {paymentOptions.cbu ? (
            <PaymentDataRow
              label="CBU/CVU"
              value={paymentOptions.cbu}
              copied={copiedKey === "cbu"}
              onCopy={() => void copyValue("cbu", paymentOptions.cbu)}
            />
          ) : null}
        </div>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          Configura alias, CVU o link de pago en el archivo .env para mostrar
          datos de pago automaticos.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {suggestedPayment > 0 ? (
          <button
            type="button"
            onClick={() => void startMercadoPagoCheckout("deposit")}
            disabled={mercadoPagoState.status === "loading"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ExternalLink className="h-4 w-4" />
            {mercadoPagoState.status === "loading" &&
            mercadoPagoState.mode === "deposit"
              ? "Creando pago"
              : "Pagar sena"}
          </button>
        ) : null}
        {booking.balanceDue > suggestedPayment ? (
          <button
            type="button"
            onClick={() => void startMercadoPagoCheckout("balance")}
            disabled={mercadoPagoState.status === "loading"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ExternalLink className="h-4 w-4" />
            {mercadoPagoState.status === "loading" &&
            mercadoPagoState.mode === "balance"
              ? "Creando pago"
              : "Pagar saldo"}
          </button>
        ) : null}
      </div>

      {mercadoPagoState.status === "error" ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          {mercadoPagoState.message}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {paymentOptions.paymentLink ? (
          <a
            href={paymentOptions.paymentLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir link de pago
          </a>
        ) : null}
        <a
          href={noticeHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
        >
          <MessageCircle className="h-4 w-4" />
          Avisar pago
        </a>
      </div>
    </div>
  );
}

function getSuggestedPaymentAmount(booking: PaymentActionBooking) {
  const remainingDeposit = Math.max(0, booking.deposit - booking.paidTotal);

  return Math.min(
    remainingDeposit > 0 ? remainingDeposit : booking.balanceDue,
    booking.balanceDue,
  );
}

function PaymentMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <p className="font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function PaymentDataRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div>
        <p className="font-medium text-slate-500">{label}</p>
        <p className="font-semibold text-slate-950">{value}</p>
      </div>
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
        >
          {copied ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copiado" : "Copiar"}
        </button>
      ) : null}
    </div>
  );
}
