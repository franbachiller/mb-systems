"use client";

import { MessageCircle, Printer } from "lucide-react";

export default function BookingDetailActions({
  whatsAppActions,
}: {
  whatsAppActions: Array<{
    href: string;
    label: string;
  }>;
}) {
  return (
    <div className="print-hidden flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        <Printer className="h-4 w-4" />
        Imprimir
      </button>

      {whatsAppActions.map((action) => (
        <a
          key={action.label}
          href={action.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
        >
          <MessageCircle className="h-4 w-4" />
          {action.label}
        </a>
      ))}
    </div>
  );
}
