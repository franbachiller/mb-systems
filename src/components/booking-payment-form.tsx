"use client";

import { useRouter } from "next/navigation";
import { CircleDollarSign, Save } from "lucide-react";
import { useState } from "react";
import { paymentMethods, type PaymentMethod } from "@/lib/rental-data";

type SaveState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const methodLabels: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export default function BookingPaymentForm({
  bookingId,
  balanceDue,
}: {
  bookingId: string;
  balanceDue: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(balanceDue > 0 ? String(balanceDue) : "");
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const parsedAmount = Number.parseInt(amount, 10);
  const canSubmit =
    balanceDue > 0 &&
    !submitting &&
    Number.isInteger(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= balanceDue;

  async function submitPayment() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setSaveState({ status: "idle" });

    try {
      const response = await fetch(`/api/bookings/${bookingId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          method,
          note,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo registrar el pago.");
      }

      setNote("");
      setSaveState({ status: "success", message: "Pago registrado." });
      router.refresh();
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error ? error.message : "No se pudo registrar el pago.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (balanceDue <= 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
        Reserva saldada.
      </div>
    );
  }

  return (
    <div className="print-hidden grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <CircleDollarSign className="h-4 w-4 text-cyan-700" />
        <p className="text-sm font-semibold text-slate-950">Registrar pago</p>
      </div>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Importe
        <input
          type="number"
          min={1}
          max={balanceDue}
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setSaveState({ status: "idle" });
          }}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Metodo
        <select
          value={method}
          onChange={(event) => {
            setMethod(event.target.value as PaymentMethod);
            setSaveState({ status: "idle" });
          }}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        >
          {paymentMethods.map((currentMethod) => (
            <option key={currentMethod} value={currentMethod}>
              {methodLabels[currentMethod]}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Nota opcional
        <input
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setSaveState({ status: "idle" });
          }}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
        />
      </label>

      {saveState.status !== "idle" ? (
        <p
          className={`text-sm font-medium ${
            saveState.status === "success" ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {saveState.message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void submitPayment()}
        disabled={!canSubmit}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Save className="h-4 w-4" />
        {submitting ? "Guardando" : "Guardar pago"}
      </button>
    </div>
  );
}
