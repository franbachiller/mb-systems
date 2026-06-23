"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, LogIn } from "lucide-react";
import { useState } from "react";
import BrandMark from "@/components/brand-mark";

type LoginState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

export default function AdminLoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [loginState, setLoginState] = useState<LoginState>({ status: "idle" });
  const canSubmit = pin.trim().length > 0 && loginState.status !== "submitting";

  async function submitLogin() {
    if (!canSubmit) {
      return;
    }

    setLoginState({ status: "submitting" });

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "No se pudo iniciar sesion.");
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setLoginState({
        status: "error",
        message:
          error instanceof Error ? error.message : "No se pudo iniciar sesion.",
      });
    }
  }

  return (
    <div className="public-shell min-h-screen px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <main className="mx-auto grid min-h-[calc(100vh-48px)] max-w-md content-center">
        <Link
          href="/"
          className="mb-4 inline-flex w-fit items-center gap-2 text-sm font-semibold text-cyan-700 transition hover:text-cyan-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>

        <section className="date-panel overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <BrandMark />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-red-400">Area privada</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-slate-950">
              Acceso admin
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Gestion de reservas, inventario y operaciones.</p>
          </div>

          <div className="grid gap-4 p-5">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              PIN
              <input
                type="password"
                value={pin}
                autoComplete="current-password"
                onChange={(event) => {
                  setPin(event.target.value);
                  setLoginState({ status: "idle" });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void submitLogin();
                  }
                }}
                className="h-11 rounded-md border border-slate-300 px-3 text-base text-slate-950 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            {loginState.status === "error" ? (
              <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                <AlertTriangle className="h-4 w-4" />
                {loginState.message}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => void submitLogin()}
              disabled={!canSubmit}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <LogIn className="h-4 w-4" />
              {loginState.status === "submitting" ? "Entrando" : "Entrar"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
