"use client";

import { useRouter } from "next/navigation";
import { PackageCheck, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import type { BookingOperationStage } from "@/lib/rental-data";

type SaveState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const stageConfig = {
  retiro: {
    title: "Retiro",
    button: "Confirmar retiro",
    success: "Retiro registrado.",
    icon: PackageCheck,
    checks: ["Equipos contados", "Accesorios completos", "Prueba basica"],
  },
  devolucion: {
    title: "Devolucion",
    button: "Registrar devolucion",
    success: "Devolucion registrada.",
    icon: RotateCcw,
    checks: ["Equipos recibidos", "Accesorios completos", "Prueba tecnica"],
  },
} satisfies Record<
  BookingOperationStage,
  {
    title: string;
    button: string;
    success: string;
    icon: typeof PackageCheck;
    checks: [string, string, string];
  }
>;

export default function BookingOperationForm({
  bookingId,
  stage,
}: {
  bookingId: string;
  stage: BookingOperationStage;
}) {
  const router = useRouter();
  const config = stageConfig[stage];
  const StageIcon = config.icon;
  const [equipmentChecked, setEquipmentChecked] = useState(true);
  const [accessoriesChecked, setAccessoriesChecked] = useState(true);
  const [powerChecked, setPowerChecked] = useState(true);
  const [conditionNotes, setConditionNotes] = useState("");
  const [damageFee, setDamageFee] = useState("0");
  const [missingFee, setMissingFee] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const parsedDamageFee = parseAmount(damageFee);
  const parsedMissingFee = parseAmount(missingFee);
  const canSubmit =
    !submitting && parsedDamageFee !== null && parsedMissingFee !== null;

  async function submitOperation() {
    if (!canSubmit) {
      return;
    }

    setSubmitting(true);
    setSaveState({ status: "idle" });

    try {
      const response = await fetch(`/api/bookings/${bookingId}/operations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          equipmentChecked,
          accessoriesChecked,
          powerChecked,
          conditionNotes,
          damageFee: stage === "devolucion" ? parsedDamageFee : 0,
          missingFee: stage === "devolucion" ? parsedMissingFee : 0,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo registrar la operacion.");
      }

      setConditionNotes("");
      setDamageFee("0");
      setMissingFee("0");
      setSaveState({ status: "success", message: config.success });
      router.refresh();
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo registrar la operacion.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="print-hidden grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2">
        <StageIcon className="h-4 w-4 text-cyan-700" />
        <p className="text-sm font-semibold text-slate-950">{config.title}</p>
      </div>

      <div className="grid gap-2">
        <ChecklistControl
          checked={equipmentChecked}
          label={config.checks[0]}
          onChange={setEquipmentChecked}
        />
        <ChecklistControl
          checked={accessoriesChecked}
          label={config.checks[1]}
          onChange={setAccessoriesChecked}
        />
        <ChecklistControl
          checked={powerChecked}
          label={config.checks[2]}
          onChange={setPowerChecked}
        />
      </div>

      {stage === "devolucion" ? (
        <div className="grid gap-2">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Cargo danos
            <input
              type="number"
              min={0}
              value={damageFee}
              onChange={(event) => {
                setDamageFee(event.target.value);
                setSaveState({ status: "idle" });
              }}
              className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Cargo faltantes
            <input
              type="number"
              min={0}
              value={missingFee}
              onChange={(event) => {
                setMissingFee(event.target.value);
                setSaveState({ status: "idle" });
              }}
              className="h-10 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
            />
          </label>
        </div>
      ) : null}

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Notas
        <textarea
          value={conditionNotes}
          rows={3}
          onChange={(event) => {
            setConditionNotes(event.target.value);
            setSaveState({ status: "idle" });
          }}
          className="min-h-20 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
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
        onClick={() => void submitOperation()}
        disabled={!canSubmit}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Save className="h-4 w-4" />
        {submitting ? "Guardando" : config.button}
      </button>
    </div>
  );
}

function ChecklistControl({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-cyan-700"
      />
      {label}
    </label>
  );
}

function parseAmount(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
}
