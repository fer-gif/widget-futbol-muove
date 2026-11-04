"use client";

// Avisos flotantes (reemplazan a alert()). Uso: toast.success("Guardado"), toast.error("...").
import { useEffect, useState } from "react";

type Kind = "success" | "error" | "info";
type Toast = { id: number; kind: Kind; text: string };

let listeners: ((t: Toast[]) => void)[] = [];
let toasts: Toast[] = [];
let nextId = 1;

function emit() {
  listeners.forEach((l) => l(toasts));
}

function push(kind: Kind, text: string, ms = kind === "error" ? 6000 : 3500) {
  const t = { id: nextId++, kind, text };
  toasts = [...toasts.slice(-3), t];
  emit();
  setTimeout(() => dismiss(t.id), ms);
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (text: string) => push("success", text),
  error: (text: string) => push("error", text),
  info: (text: string) => push("info", text),
};

const STYLES: Record<Kind, string> = {
  success: "bg-[#0f1f14] border-green-500/40 text-green-300",
  error: "bg-[#24100f] border-red-500/40 text-red-300",
  info: "bg-[#18181b] border-[#ff7900]/40 text-zinc-200",
};
const ICONS: Record<Kind, string> = { success: "✓", error: "⚠", info: "ℹ" };

export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto flex flex-col gap-2 items-stretch sm:items-end pointer-events-none"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex items-start gap-3 sm:max-w-sm border rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl shadow-black/60 ${STYLES[t.kind]}`}
        >
          <span aria-hidden="true">{ICONS[t.kind]}</span>
          <span className="flex-1 break-words">{t.text}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Cerrar aviso"
            className="opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
