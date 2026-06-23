import {
  type AdminBooking,
  type BookingStatus,
  type PaymentMethod,
  type PublicBooking,
} from "@/lib/rental-data";

export type BookingMessageKind =
  | "confirmacion"
  | "saldo"
  | "retiro"
  | "devolucion";

export const bookingMessageKindLabels: Record<BookingMessageKind, string> = {
  confirmacion: "Confirmar",
  saldo: "Saldo",
  retiro: "Retiro",
  devolucion: "Devolucion",
};

type MessageBooking = {
  id: string;
  clientName: string;
  clientPhone?: string;
  start: string;
  end: string;
  status: BookingStatus;
  deposit: number;
  totalDue: number;
  paidTotal: number;
  balanceDue: number;
  items: Array<{
    productName: string;
    quantity: number;
  }>;
  payments?: Array<{
    amount: number;
    method: PaymentMethod;
    createdAt: string;
  }>;
};

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
  pendiente: "pendiente",
  confirmado: "confirmada",
  pagado: "pagada",
  retirado: "retirada",
  devuelto: "devuelta",
  cancelado: "cancelada",
};

export function buildBookingMessage(
  booking: AdminBooking | PublicBooking,
  kind: BookingMessageKind,
) {
  const normalizedBooking = toMessageBooking(booking);
  const summaryLines = [
    `Reserva: ${normalizedBooking.id}`,
    `Retiro: ${formatDate(normalizedBooking.start)}`,
    `Devolucion: ${formatDate(normalizedBooking.end)}`,
    `Equipos: ${formatItems(normalizedBooking)}`,
  ];
  const paymentLines = [
    `Total: ${formatCurrency(normalizedBooking.totalDue)}`,
    `Anticipo sugerido: ${formatCurrency(normalizedBooking.deposit)}`,
    `Pagado: ${formatCurrency(normalizedBooking.paidTotal)}`,
    `Saldo: ${formatCurrency(normalizedBooking.balanceDue)}`,
  ];

  if (kind === "confirmacion") {
    return [
      `Hola ${normalizedBooking.clientName}, tu reserva en MB Systems esta ${statusLabels[normalizedBooking.status]}.`,
      ...summaryLines,
      ...paymentLines,
      `Podes consultar el estado con el codigo ${normalizedBooking.id} y tu WhatsApp.`,
    ].join("\n");
  }

  if (kind === "saldo") {
    return [
      `Hola ${normalizedBooking.clientName}, te paso el saldo de tu reserva ${normalizedBooking.id}.`,
      ...paymentLines,
      normalizedBooking.balanceDue > 0
        ? "El saldo se abona antes o al momento del retiro."
        : "La reserva figura sin saldo pendiente.",
    ].join("\n");
  }

  if (kind === "retiro") {
    return [
      `Hola ${normalizedBooking.clientName}, recordatorio de retiro de la reserva ${normalizedBooking.id}.`,
      `Retiro: ${formatDate(normalizedBooking.start)}`,
      `Equipos: ${formatItems(normalizedBooking)}`,
      `Saldo pendiente: ${formatCurrency(normalizedBooking.balanceDue)}`,
    ].join("\n");
  }

  return [
    `Hola ${normalizedBooking.clientName}, recordatorio de devolucion de la reserva ${normalizedBooking.id}.`,
    `Devolucion: ${formatDate(normalizedBooking.end)}`,
    `Equipos: ${formatItems(normalizedBooking)}`,
    "Al devolver revisamos equipos, accesorios y funcionamiento.",
  ].join("\n");
}

export function buildWhatsAppHref(phone: string | undefined, message: string) {
  const text = encodeURIComponent(message);
  const phoneDigits = normalizePhoneDigits(phone ?? "");

  if (phoneDigits.length < 8) {
    return `https://wa.me/?text=${text}`;
  }

  return `https://wa.me/${phoneDigits}?text=${text}`;
}

export function buildCustomerSupportMessage(booking: PublicBooking) {
  return [
    `Hola MB Systems, quiero consultar por mi reserva ${booking.id}.`,
    `Nombre: ${booking.clientName}`,
    `Estado: ${statusLabels[booking.status]}`,
    `Retiro: ${formatDate(booking.start)}`,
    `Saldo: ${formatCurrency(booking.balanceDue)}`,
  ].join("\n");
}

export function buildPaymentNoticeMessage(booking: {
  id: string;
  clientName: string;
  deposit: number;
  totalDue: number;
  paidTotal: number;
  balanceDue: number;
}) {
  const pendingDeposit = Math.min(
    booking.deposit,
    Math.max(0, booking.balanceDue),
  );

  return [
    `Hola MB Systems, quiero avisar el pago de mi reserva ${booking.id}.`,
    `Nombre: ${booking.clientName}`,
    `Total: ${formatCurrency(booking.totalDue)}`,
    `Anticipo sugerido: ${formatCurrency(booking.deposit)}`,
    `Pago pendiente sugerido: ${formatCurrency(pendingDeposit)}`,
    `Pagado registrado: ${formatCurrency(booking.paidTotal)}`,
    `Saldo actual: ${formatCurrency(booking.balanceDue)}`,
  ].join("\n");
}

export function getBusinessWhatsAppPhone() {
  return process.env.NEXT_PUBLIC_BUSINESS_WHATSAPP?.trim() ?? "";
}

function toMessageBooking(booking: AdminBooking | PublicBooking): MessageBooking {
  return {
    id: booking.id,
    clientName: booking.clientName,
    clientPhone: "clientPhone" in booking ? booking.clientPhone : undefined,
    start: booking.start,
    end: booking.end,
    status: booking.status,
    deposit: booking.deposit,
    totalDue: booking.totalDue,
    paidTotal: booking.paidTotal,
    balanceDue: booking.balanceDue,
    items: booking.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
    })),
    payments: booking.payments,
  };
}

function formatItems(booking: MessageBooking) {
  return booking.items
    .map((item) => `${item.quantity} x ${item.productName}`)
    .join(", ");
}

function normalizePhoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}
