import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Phone,
  ReceiptText,
  UserRound,
} from "lucide-react";
import BookingDetailActions from "@/components/booking-detail-actions";
import BookingEditForm from "@/components/booking-edit-form";
import BookingOperationForm from "@/components/booking-operation-form";
import BookingPaymentForm from "@/components/booking-payment-form";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import {
  bookingMessageKindLabels,
  buildBookingMessage,
  buildWhatsAppHref,
  type BookingMessageKind,
} from "@/lib/booking-messages";
import {
  getRentalDays,
  type AdminBooking,
  type BookingOperationStage,
  type BookingStatus,
  type PaymentMethod,
} from "@/lib/rental-data";
import {
  getAdminBookingById,
  listInventoryProducts,
  RentalDbError,
} from "@/lib/rental-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

const operationStageLabels: Record<BookingOperationStage, string> = {
  retiro: "Retiro",
  devolucion: "Devolucion",
};

const bookingMessageKinds: BookingMessageKind[] = [
  "confirmacion",
  "saldo",
  "retiro",
  "devolucion",
];

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!(await isAdminAuthenticated())) {
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/bookings/${id}`)}`);
  }

  const booking = getBookingOrNotFound(id);
  const products = listInventoryProducts();
  const rentalDays = getRentalDays({ start: booking.start, end: booking.end });
  const balance = booking.balanceDue;
  const bookingEditKey = [
    booking.id,
    booking.clientName,
    booking.clientPhone,
    booking.clientEmail ?? "",
    booking.start,
    booking.end,
    booking.subtotal,
    booking.items
      .map((item) => `${item.productId}:${item.quantity}:${item.pricePerDay}`)
      .join("|"),
  ].join(":");
  const whatsAppActions = bookingMessageKinds.map((kind) => ({
    label: bookingMessageKindLabels[kind],
    href: buildWhatsAppHref(
      booking.clientPhone,
      buildBookingMessage(booking, kind),
    ),
  }));

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-4">
        <div className="print-hidden flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 transition hover:text-cyan-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al admin
          </Link>
          <BookingDetailActions whatsAppActions={whatsAppActions} />
        </div>

        <BookingEditForm
          key={bookingEditKey}
          booking={booking}
          products={products}
        />

        <section className="print-page overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  Comprobante de reserva
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">
                  Reserva {booking.id}
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  MB Systems - alquiler de luces, sonido y equipamiento.
                </p>
              </div>
              <span
                className={`inline-flex w-fit rounded-md border px-3 py-1 text-sm font-semibold ${statusStyles[booking.status]}`}
              >
                {booking.status}
              </span>
            </div>
          </header>

          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_300px]">
            <div className="grid content-start gap-5">
              <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <UserRound className="h-5 w-5 text-cyan-700" />
                  <h2 className="text-lg font-semibold text-slate-950">
                    Cliente
                  </h2>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <DetailField label="Nombre" value={booking.clientName} />
                  <DetailField label="Telefono" value={booking.clientPhone} />
                  <DetailField
                    label="Email"
                    value={booking.clientEmail ?? "Sin email"}
                  />
                  <DetailField
                    label="Creada"
                    value={formatDate(booking.createdAt)}
                  />
                </div>
              </section>

              <section className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-cyan-700" />
                  <h2 className="text-lg font-semibold text-slate-950">
                    Fechas
                  </h2>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <DetailField label="Retiro" value={formatDate(booking.start)} />
                  <DetailField label="Devolucion" value={formatDate(booking.end)} />
                  <DetailField
                    label="Duracion"
                    value={`${rentalDays} dia${rentalDays > 1 ? "s" : ""}`}
                  />
                </div>
              </section>

              <section className="overflow-hidden rounded-md border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-cyan-700" />
                    <h2 className="text-lg font-semibold text-slate-950">
                      Equipos reservados
                    </h2>
                  </div>
                </div>
                <div className="divide-y divide-slate-200">
                  {booking.items.map((item) => {
                    const lineTotal = item.quantity * item.pricePerDay * rentalDays;

                    return (
                      <div
                        key={item.productId}
                        className="grid gap-3 p-4 text-sm sm:grid-cols-[1fr_90px_120px_120px]"
                      >
                        <p className="font-semibold text-slate-950">
                          {item.productName}
                        </p>
                        <p className="text-slate-600">{item.quantity} un.</p>
                        <p className="text-slate-600">
                          {currencyFormatter.format(item.pricePerDay)} / dia
                        </p>
                        <p className="font-semibold text-slate-950">
                          {currencyFormatter.format(lineTotal)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <BookingOperationsPanel booking={booking} />
            </div>

            <aside className="grid content-start gap-4">
              <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <CircleDollarSign className="h-5 w-5 text-cyan-700" />
                  <h2 className="text-lg font-semibold text-slate-950">
                    Importe
                  </h2>
                </div>
                <div className="mt-4 grid gap-3 text-sm">
                  <SummaryRow
                    label="Subtotal"
                    value={currencyFormatter.format(booking.subtotal)}
                  />
                  <SummaryRow
                    label="Cargos"
                    value={currencyFormatter.format(booking.extraCharges)}
                  />
                  <SummaryRow
                    label="Total"
                    value={currencyFormatter.format(booking.totalDue)}
                  />
                  <SummaryRow
                    label="Anticipo sugerido"
                    value={currencyFormatter.format(booking.deposit)}
                  />
                  <SummaryRow
                    label="Pagado"
                    value={currencyFormatter.format(booking.paidTotal)}
                  />
                  <SummaryRow
                    label="Saldo"
                    value={currencyFormatter.format(balance)}
                  />
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <ReceiptText className="h-5 w-5 text-cyan-700" />
                  <h2 className="text-lg font-semibold text-slate-950">
                    Pagos
                  </h2>
                </div>
                <div className="mt-4">
                  <BookingPaymentForm
                    key={`${booking.id}-${booking.balanceDue}`}
                    bookingId={booking.id}
                    balanceDue={booking.balanceDue}
                  />
                </div>
                <div className="mt-4 grid gap-2">
                  {booking.payments.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      Sin pagos registrados.
                    </p>
                  ) : (
                    booking.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-slate-950">
                            {currencyFormatter.format(payment.amount)}
                          </p>
                          <p className="font-medium text-slate-500">
                            {methodLabels[payment.method]}
                          </p>
                        </div>
                        <p className="mt-1 text-slate-500">
                          {formatDate(payment.createdAt)}
                        </p>
                        {payment.note ? (
                          <p className="mt-2 text-slate-600">{payment.note}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-md border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-cyan-700" />
                  <h2 className="text-lg font-semibold text-slate-950">
                    Contacto
                  </h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Usar este comprobante para confirmar retiro, devolucion,
                  equipos entregados y saldo pendiente.
                </p>
              </section>
            </aside>
          </div>

          <section className="border-t border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-950">
              Condiciones basicas
            </h2>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600">
              <p>
                El cliente recibe los equipos en buen estado y se compromete a
                devolverlos en la fecha acordada.
              </p>
              <p>
                Roturas, faltantes o demoras pueden generar cargos adicionales
                segun revision al regreso.
              </p>
              <p>
                La reserva queda sujeta al pago del anticipo y a la disponibilidad
                operativa del inventario.
              </p>
            </div>

            <div className="mt-8 grid gap-8 pt-6 sm:grid-cols-2">
              <SignatureLine label="Firma cliente" />
              <SignatureLine label="Firma entrega" />
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function BookingOperationsPanel({ booking }: { booking: AdminBooking }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-cyan-700" />
        <h2 className="text-lg font-semibold text-slate-950">
          Checklist operativo
        </h2>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="grid content-start gap-3">
          <BookingOperationForm bookingId={booking.id} stage="retiro" />
          <BookingOperationForm bookingId={booking.id} stage="devolucion" />
        </div>

        <div className="grid content-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-sm font-semibold text-slate-950">
            Historial operativo
          </h3>
          {booking.operations.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
              Sin operaciones registradas.
            </p>
          ) : (
            booking.operations.map((operation) => {
              const operationCharges = operation.damageFee + operation.missingFee;

              return (
                <div
                  key={operation.id}
                  className="rounded-md border border-slate-200 bg-white p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-950">
                      {operationStageLabels[operation.stage]}
                    </p>
                    <p className="font-medium text-slate-500">
                      {formatDate(operation.createdAt)}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <OperationPill
                      active={operation.equipmentChecked}
                      label="Equipos"
                    />
                    <OperationPill
                      active={operation.accessoriesChecked}
                      label="Accesorios"
                    />
                    <OperationPill
                      active={operation.powerChecked}
                      label="Prueba"
                    />
                  </div>
                  {operationCharges > 0 ? (
                    <p className="mt-2 font-semibold text-rose-700">
                      Cargos {currencyFormatter.format(operationCharges)}
                    </p>
                  ) : null}
                  {operation.conditionNotes ? (
                    <p className="mt-2 leading-6 text-slate-600">
                      {operation.conditionNotes}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function getBookingOrNotFound(id: string) {
  try {
    return getAdminBookingById(id);
  } catch (error) {
    if (error instanceof RentalDbError && error.code === "BOOKING_NOT_FOUND") {
      notFound();
    }

    throw error;
  }
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function OperationPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs font-semibold ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {label}
    </span>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="border-t border-slate-300" />
      <p className="mt-2 text-sm font-medium text-slate-500">{label}</p>
    </div>
  );
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}
