"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  MessageCircle,
  PackageCheck,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import BrandMark from "@/components/brand-mark";
import PublicPaymentActions from "@/components/public-payment-actions";
import {
  getRentalDays,
  type BookingStatus,
  type PaymentMethod,
  type PublicBooking,
} from "@/lib/rental-data";
import {
  buildCustomerSupportMessage,
  buildWhatsAppHref,
  getBusinessWhatsAppPhone,
} from "@/lib/booking-messages";
import { readPublicPaymentLookupSession } from "@/lib/public-payment-session";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; booking: PublicBooking }
  | { status: "error"; message: string };

type PaymentReturnStatus = "none" | "approved" | "pending" | "failed";

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const statusLabels: Record<BookingStatus, string> = {
  pendiente: "Pendiente",
  confirmado: "Confirmada",
  pagado: "Pagada",
  retirado: "Retirada",
  devuelto: "Devuelta",
  cancelado: "Cancelada",
};

const statusStyles: Record<BookingStatus, string> = {
  pendiente: "border-amber-200 bg-amber-50 text-amber-800",
  confirmado: "border-cyan-200 bg-cyan-50 text-cyan-800",
  pagado: "border-emerald-200 bg-emerald-50 text-emerald-800",
  retirado: "border-indigo-200 bg-indigo-50 text-indigo-800",
  devuelto: "border-slate-200 bg-slate-50 text-slate-700",
  cancelado: "border-rose-200 bg-rose-50 text-rose-700",
};

const methodLabels: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export default function BookingLookupWorkspace({
  initialBookingId,
  paymentReturnStatus,
}: {
  initialBookingId: string;
  paymentReturnStatus: PaymentReturnStatus;
}) {
  const [bookingId, setBookingId] = useState(initialBookingId);
  const [phone, setPhone] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>({ status: "idle" });
  const canSubmit =
    bookingId.trim().length > 0 &&
    phone.trim().length > 0 &&
    lookupState.status !== "loading";

  async function submitLookup() {
    if (!canSubmit) {
      return;
    }

    await submitLookupWithValues(bookingId, phone);
  }

  async function submitLookupWithValues(nextBookingId: string, nextPhone: string) {
    setLookupState({ status: "loading" });

    try {
      const response = await fetch("/api/public-bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: nextBookingId, phone: nextPhone }),
      });
      const data = (await response.json()) as {
        booking?: PublicBooking;
        error?: string;
      };

      if (!response.ok || !data.booking) {
        throw new Error(data.error ?? "No se pudo consultar la reserva.");
      }

      setLookupState({ status: "success", booking: data.booking });
    } catch (error) {
      setLookupState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo consultar la reserva.",
      });
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const session = readPublicPaymentLookupSession(initialBookingId);

      if (!session) {
        return;
      }

      setPhone(session.phone);
      void submitLookupWithValues(initialBookingId, session.phone);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [initialBookingId]);

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-cyan-700 transition hover:text-cyan-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <div>
            <BrandMark />
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">
              Consulta de reserva
            </h1>
          </div>
          {paymentReturnStatus !== "none" ? (
            <PaymentReturnNotice status={paymentReturnStatus} />
          ) : null}
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[380px_1fr] lg:px-8">
        <div className="h-fit overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">Reserva</p>
                <h2 className="text-xl font-semibold text-slate-950">
                  Buscar estado
                </h2>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-800">
                <Search className="h-5 w-5" />
              </span>
            </div>
          </div>

          <div className="grid gap-3 p-4">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Codigo
              <input
                value={bookingId}
                onChange={(event) => {
                  setBookingId(event.target.value);
                  setLookupState({ status: "idle" });
                }}
                placeholder="res-..."
                className="h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="grid gap-1 text-sm font-medium text-slate-700">
              WhatsApp
              <input
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setLookupState({ status: "idle" });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void submitLookup();
                  }
                }}
                className="h-11 rounded-md border border-slate-300 px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            {lookupState.status === "error" ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {lookupState.message}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void submitLookup()}
              disabled={!canSubmit}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Search className="h-4 w-4" />
              {lookupState.status === "loading" ? "Buscando" : "Consultar"}
            </button>
          </div>
        </div>

        {lookupState.status === "success" ? (
          <BookingResult booking={lookupState.booking} lookupPhone={phone} />
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-4 text-center">
            <ClipboardList className="h-9 w-9 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-600">
              Sin consulta cargada.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function BookingResult({
  booking,
  lookupPhone,
}: {
  booking: PublicBooking;
  lookupPhone: string;
}) {
  const rentalDays = getRentalDays({ start: booking.start, end: booking.end });
  const contactHref = buildWhatsAppHref(
    getBusinessWhatsAppPhone(),
    buildCustomerSupportMessage(booking),
  );

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Reserva {booking.id}
            </p>
            <h2 className="text-2xl font-semibold tracking-normal text-slate-950">
              {booking.clientName}
            </h2>
          </div>
          <span
            className={`inline-flex w-fit rounded-md border px-3 py-1 text-sm font-semibold ${statusStyles[booking.status]}`}
          >
            {statusLabels[booking.status]}
          </span>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-3">
          <InfoTile
            icon={<CalendarDays />}
            label="Retiro"
            value={formatDate(booking.start)}
          />
          <InfoTile
            icon={<CalendarDays />}
            label="Devolucion"
            value={formatDate(booking.end)}
          />
          <InfoTile
            icon={<CheckCircle2 />}
            label="Duracion"
            value={`${rentalDays} dia${rentalDays > 1 ? "s" : ""}`}
          />
        </div>
        <div className="border-t border-slate-200 p-4">
          <a
            href={contactHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
          >
            <MessageCircle className="h-4 w-4" />
            Contactar por WhatsApp
          </a>
        </div>
      </section>

      <PublicPaymentActions booking={booking} lookupPhone={lookupPhone} />

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-cyan-700" />
            <h3 className="text-lg font-semibold text-slate-950">Equipos</h3>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {booking.items.map((item) => {
            const lineTotal = item.quantity * item.pricePerDay * rentalDays;

            return (
              <div
                key={item.productName}
                className="grid gap-2 p-4 text-sm sm:grid-cols-[1fr_90px_120px]"
              >
                <p className="font-semibold text-slate-950">
                  {item.productName}
                </p>
                <p className="text-slate-600">{item.quantity} un.</p>
                <p className="font-semibold text-slate-950">
                  {formatCurrency(lineTotal)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-cyan-700" />
            <h3 className="text-lg font-semibold text-slate-950">Pagos</h3>
          </div>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <SummaryRow label="Total" value={formatCurrency(booking.totalDue)} />
          <SummaryRow
            label="Anticipo sugerido"
            value={formatCurrency(booking.deposit)}
          />
          <SummaryRow label="Pagado" value={formatCurrency(booking.paidTotal)} />
          <SummaryRow label="Saldo" value={formatCurrency(booking.balanceDue)} />
        </div>
        <div className="border-t border-slate-200 p-4">
          {booking.payments.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              Sin pagos registrados.
            </p>
          ) : (
            <div className="grid gap-2">
              {booking.payments.map((payment) => (
                <div
                  key={`${payment.createdAt}-${payment.amount}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-slate-950">
                    {formatCurrency(payment.amount)}
                  </p>
                  <p className="font-medium text-slate-500">
                    {methodLabels[payment.method]} - {formatDate(payment.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <span className="flex h-4 w-4 items-center justify-center text-slate-400">
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-2 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function PaymentReturnNotice({ status }: { status: PaymentReturnStatus }) {
  const config = {
    approved: {
      title: "Pago aprobado",
      body: "Estamos actualizando la reserva. Si no aparece como pagada todavia, volve a consultar en unos segundos.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
    pending: {
      title: "Pago en proceso",
      body: "Mercado Pago todavia esta procesando la operacion. La reserva se actualiza cuando llegue la confirmacion.",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    failed: {
      title: "Pago no confirmado",
      body: "No se completo el pago. Podes intentar de nuevo o avisarnos por WhatsApp.",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    },
    none: {
      title: "",
      body: "",
      className: "",
    },
  } satisfies Record<
    PaymentReturnStatus,
    { title: string; body: string; className: string }
  >;
  const currentConfig = config[status];

  if (status === "none") {
    return null;
  }

  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${currentConfig.className}`}>
      <p className="font-semibold">{currentConfig.title}</p>
      <p className="mt-1 leading-5">{currentConfig.body}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}
