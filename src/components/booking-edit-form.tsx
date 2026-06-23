"use client";

import { useRouter } from "next/navigation";
import { Minus, PencilLine, Plus, RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import {
  getRentalDays,
  isValidRentalWindow,
  type AdminBooking,
  type Product,
  type RentalWindow,
} from "@/lib/rental-data";

type EditBookingItem = {
  productId: string;
  quantity: number;
};

type EditBookingForm = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  window: RentalWindow;
  items: EditBookingItem[];
};

type SaveState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function BookingEditForm({
  booking,
  products,
}: {
  booking: AdminBooking;
  products: Product[];
}) {
  const router = useRouter();
  const fallbackProductId = products[0]?.id ?? "";
  const [savedBooking, setSavedBooking] = useState(booking);
  const [form, setForm] = useState(() =>
    createFormFromBooking(booking, fallbackProductId),
  );
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const validWindow = isValidRentalWindow(form.window);
  const rentalDays = getRentalDays(form.window);
  const estimatedSubtotal = form.items.reduce((total, item) => {
    const product = productsById.get(item.productId);

    if (!product) {
      return total;
    }

    return total + product.pricePerDay * item.quantity * rentalDays;
  }, 0);
  const estimatedDeposit = Math.ceil(estimatedSubtotal * 0.3);
  const hasValidItems =
    form.items.length > 0 &&
    form.items.every(
      (item) =>
        item.productId.length > 0 &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0,
    );
  const canSubmit =
    !submitting &&
    validWindow &&
    hasValidItems &&
    form.customerName.trim().length > 0 &&
    form.customerPhone.trim().length > 0;

  function updateCustomer(
    field: "customerName" | "customerPhone" | "customerEmail",
    value: string,
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveState({ status: "idle" });
  }

  function updateWindow(field: keyof RentalWindow, value: string) {
    setForm((current) => ({
      ...current,
      window: { ...current.window, [field]: value },
    }));
    setSaveState({ status: "idle" });
  }

  function updateItem(
    index: number,
    field: keyof EditBookingItem,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]:
                field === "quantity"
                  ? Math.max(1, Number.parseInt(value, 10) || 1)
                  : value,
            }
          : item,
      ),
    }));
    setSaveState({ status: "idle" });
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, { productId: fallbackProductId, quantity: 1 }],
    }));
    setSaveState({ status: "idle" });
  }

  function removeItem(index: number) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? current.items
          : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setSaveState({ status: "idle" });
  }

  function resetForm() {
    setForm(createFormFromBooking(savedBooking, fallbackProductId));
    setSaveState({ status: "idle" });
  }

  async function submitChanges() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setSaveState({ status: "idle" });

    try {
      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            name: form.customerName,
            phone: form.customerPhone,
            email: form.customerEmail,
          },
          start: form.window.start,
          end: form.window.end,
          items: form.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await response.json()) as {
        booking?: AdminBooking;
        error?: string;
      };

      if (!response.ok || !data.booking) {
        throw new Error(data.error ?? "No se pudo actualizar la reserva.");
      }

      setSavedBooking(data.booking);
      setForm(createFormFromBooking(data.booking, fallbackProductId));
      setSaveState({ status: "success", message: "Reserva actualizada." });
      router.refresh();
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar la reserva.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="print-hidden rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <PencilLine className="h-5 w-5 text-cyan-700" />
          <div>
            <p className="text-sm font-semibold text-slate-500">Gestion</p>
            <h2 className="text-lg font-semibold text-slate-950">
              Editar reserva
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetForm}
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar
          </button>
          <button
            type="button"
            onClick={() => void submitChanges()}
            disabled={!canSubmit}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Save className="h-4 w-4" />
            {submitting ? "Guardando" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Cliente
            <input
              value={form.customerName}
              onChange={(event) =>
                updateCustomer("customerName", event.target.value)
              }
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            WhatsApp
            <input
              value={form.customerPhone}
              onChange={(event) =>
                updateCustomer("customerPhone", event.target.value)
              }
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Email opcional
            <input
              value={form.customerEmail}
              onChange={(event) =>
                updateCustomer("customerEmail", event.target.value)
              }
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_170px]">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Retiro
            <input
              type="datetime-local"
              value={form.window.start}
              onChange={(event) => updateWindow("start", event.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Devolucion
            <input
              type="datetime-local"
              value={form.window.end}
              onChange={(event) => updateWindow("end", event.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <div className="grid content-end rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-500">Duracion</span>
            <span className="font-semibold text-slate-950">
              {validWindow
                ? `${rentalDays} dia${rentalDays > 1 ? "s" : ""}`
                : "Rango invalido"}
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          {form.items.map((item, index) => {
            const product = productsById.get(item.productId);

            return (
              <div
                key={`${item.productId}-${index}`}
                className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_120px_130px_44px] md:items-end"
              >
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Equipo
                  <select
                    value={item.productId}
                    onChange={(event) =>
                      updateItem(index, "productId", event.target.value)
                    }
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  >
                    {products.map((currentProduct) => (
                      <option key={currentProduct.id} value={currentProduct.id}>
                        {currentProduct.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-slate-700">
                  Cantidad
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, "quantity", event.target.value)
                    }
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  />
                </label>
                <div className="grid h-10 content-center rounded-md border border-slate-200 bg-white px-3 text-sm">
                  <span className="font-semibold text-slate-950">
                    {product
                      ? currencyFormatter.format(product.pricePerDay)
                      : "$ 0"}
                  </span>
                </div>
                <button
                  type="button"
                  title="Quitar equipo"
                  aria-label="Quitar equipo"
                  onClick={() => removeItem(index)}
                  disabled={form.items.length === 1}
                  className="inline-flex h-10 w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addItem}
            disabled={products.length === 0 || submitting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Agregar equipo
          </button>
        </div>

        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-3">
          <SummaryMetric
            label="Subtotal"
            value={currencyFormatter.format(estimatedSubtotal)}
          />
          <SummaryMetric
            label="Anticipo 30%"
            value={currencyFormatter.format(estimatedDeposit)}
          />
          <SummaryMetric
            label="Pagado"
            value={currencyFormatter.format(booking.paidTotal)}
          />
        </div>

        {saveState.status !== "idle" ? (
          <p
            className={`text-sm font-semibold ${
              saveState.status === "success"
                ? "text-emerald-700"
                : "text-rose-700"
            }`}
          >
            {saveState.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function createFormFromBooking(
  booking: AdminBooking,
  fallbackProductId: string,
): EditBookingForm {
  return {
    customerName: booking.clientName,
    customerPhone: booking.clientPhone,
    customerEmail: booking.clientEmail ?? "",
    window: {
      start: toDateTimeLocalValue(booking.start),
      end: toDateTimeLocalValue(booking.end),
    },
    items:
      booking.items.length > 0
        ? booking.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          }))
        : [{ productId: fallbackProductId, quantity: 1 }],
  };
}

function toDateTimeLocalValue(value: string) {
  if (value.includes("T")) {
    return value.slice(0, 16);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return offsetDate.toISOString().slice(0, 16);
}
