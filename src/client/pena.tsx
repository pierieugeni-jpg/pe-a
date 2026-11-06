"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { calcularCuentas, type CuentasResultado } from "@/lib/cuentas";
import type { PenaDetalle } from "@/lib/tipos";
import { api, ErrorApi } from "./api";
import { useGrupo } from "./grupo";
import { Alerta, Cargando, usePolling } from "./ui";

interface PenaCtx {
  detalle: PenaDetalle;
  cuentas: CuentasResultado;
  cerrada: boolean;
  recargar: () => Promise<void>;
  /** Para mostrar el resultado de un PATCH/POST sin esperar al próximo GET. */
  setDetalle: (d: PenaDetalle) => void;
}

const Ctx = createContext<PenaCtx | null>(null);

export function usePena(): PenaCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePena fuera de PenaProvider");
  return c;
}

export function PenaProvider({ id, children }: { id: string; children: ReactNode }) {
  const { codigo, miembros, nombre, recargar: recargarGrupo } = useGrupo();
  const [detalle, setDetalle] = useState<PenaDetalle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    try {
      setDetalle(await api<PenaDetalle>(`/g/${codigo}/penas/${id}`));
      setErr(null);
    } catch (e) {
      if ((e as ErrorApi).status === 404) setErr((e as ErrorApi).message);
    }
  }, [codigo, id]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  // Actualización automática cada 15 s con la peña abierta (también refresca miembros nuevos).
  usePolling(
    () => {
      recargar();
      recargarGrupo();
    },
    15_000,
    detalle?.pena.estado === "abierta",
  );

  const valor = useMemo<PenaCtx | null>(() => {
    if (!detalle) return null;
    const cuentas = calcularCuentas({
      asistentes: detalle.asistentes.map((a) => ({ id: a, nombre: nombre(a) })),
      gastos: detalle.gastos,
      pagos: detalle.pagos,
    });
    return { detalle, cuentas, cerrada: detalle.pena.estado === "cerrada", recargar, setDetalle };
    // miembros: si cambia un nombre, se recalcula el orden de los centavos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle, miembros, recargar]);

  if (err) {
    return (
      <div className="mx-auto max-w-md p-4">
        <Alerta>{err}</Alerta>
      </div>
    );
  }
  if (!valor) return <Cargando />;
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
