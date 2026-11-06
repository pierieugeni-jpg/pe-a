"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

// ---------- botones ----------

type Variante = "primario" | "secundario" | "peligro" | "fantasma";

const estilos: Record<Variante, string> = {
  primario: "bg-orange-600 text-white active:bg-orange-700 disabled:bg-orange-300",
  secundario: "bg-white text-stone-800 border border-stone-300 active:bg-stone-100 disabled:text-stone-400",
  peligro: "bg-white text-red-700 border border-red-300 active:bg-red-50 disabled:text-red-300",
  fantasma: "text-orange-700 active:bg-orange-50 disabled:text-stone-400",
};

export function Boton({
  variante = "primario",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-semibold transition-colors disabled:cursor-not-allowed ${estilos[variante]} ${className}`}
    />
  );
}

export function BotonLink({
  href,
  variante = "primario",
  className = "",
  children,
}: {
  href: string;
  variante?: Variante;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-semibold transition-colors ${estilos[variante]} ${className}`}
    >
      {children}
    </Link>
  );
}

// ---------- formularios ----------

export function Campo({ label, ayuda, children }: { label: string; ayuda?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-stone-500">{ayuda}</span>}
    </label>
  );
}

export const claseInput =
  "block w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 placeholder:text-stone-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200";

export function Alerta({ children, tipo = "error" }: { children: ReactNode; tipo?: "error" | "info" | "ok" }) {
  const c =
    tipo === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : tipo === "ok"
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-sm ${c}`}>
      {children}
    </div>
  );
}

/** Chip tildable para elegir personas. */
export function ChipCheck({
  activo,
  onClick,
  children,
  disabled,
}: {
  activo: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={activo}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
        activo
          ? "border-orange-600 bg-orange-600 text-white"
          : "border-stone-300 bg-white text-stone-600 line-through decoration-stone-400"
      } disabled:opacity-50`}
    >
      <span aria-hidden>{activo ? "✓" : "＋"}</span>
      {children}
    </button>
  );
}

export function Chip({ children, tono = "neutro" }: { children: ReactNode; tono?: "neutro" | "yo" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm ${
        tono === "yo" ? "bg-orange-100 font-semibold text-orange-800" : "bg-stone-100 text-stone-700"
      }`}
    >
      {children}
    </span>
  );
}

export function EstadoBadge({ estado }: { estado: "abierta" | "cerrada" }) {
  return estado === "abierta" ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Abierta</span>
  ) : (
    <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">Cerrada</span>
  );
}

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-stone-500" role="status">
      <span className="size-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      {texto}
    </div>
  );
}

export function Encabezado({ titulo, volver, derecha, sub }: { titulo: ReactNode; volver?: string; derecha?: ReactNode; sub?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/95 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-md items-center gap-1 px-2">
        {volver ? (
          <Link href={volver} aria-label="Volver" className="flex size-11 shrink-0 items-center justify-center rounded-full text-2xl text-stone-700 active:bg-stone-200">
            ‹
          </Link>
        ) : (
          <span className="w-2" />
        )}
        <div className="min-w-0 flex-1 py-2">
          <h1 className="truncate text-lg font-bold leading-tight text-stone-900">{titulo}</h1>
          {sub && <div className="truncate text-sm text-stone-500">{sub}</div>}
        </div>
        {derecha}
      </div>
    </header>
  );
}

// ---------- toasts ----------

const ToastCtx = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrar = useCallback((m: string) => {
    setMsg(m);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
        {msg && <div className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-lg">{msg}</div>}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---------- polling ----------

/** Ejecuta fn cada `ms` mientras la pestaña está visible, y al volver a ella. */
export function usePolling(fn: () => void, ms: number, activo: boolean) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") ref.current();
    }, ms);
    const alVolver = () => document.visibilityState === "visible" && ref.current();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [ms, activo]);
}
