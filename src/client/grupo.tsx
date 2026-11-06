"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { GrupoDetalle, Miembro } from "@/lib/tipos";
import { api, ErrorApi, guardarYo, leerYo, recordarGrupo } from "./api";

interface GrupoCtx {
  codigo: string;
  grupo: GrupoDetalle["grupo"];
  miembros: Miembro[];
  yo: Miembro | null;
  setYo: (id: string | null) => void;
  recargar: () => Promise<void>;
  miembro: (id: string) => Miembro | undefined;
  nombre: (id: string) => string;
}

const Ctx = createContext<GrupoCtx | null>(null);

export function useGrupo(): GrupoCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGrupo fuera de GrupoProvider");
  return c;
}

export function GrupoProvider({
  codigo,
  children,
  cargando,
  error,
}: {
  codigo: string;
  children: ReactNode;
  cargando: ReactNode;
  error: (msg: string, status: number) => ReactNode;
}) {
  const [data, setData] = useState<GrupoDetalle | null>(null);
  const [err, setErr] = useState<{ msg: string; status: number } | null>(null);
  const [yoId, setYoId] = useState<string | null | undefined>(undefined);

  const recargar = useCallback(async () => {
    try {
      const d = await api<GrupoDetalle>(`/g/${codigo}`);
      setData(d);
      setErr(null);
      recordarGrupo({ codigo, nombre: d.grupo.nombre });
    } catch (e) {
      const ea = e as ErrorApi;
      // Si ya teníamos datos, un error de red pasajero no tapa la pantalla.
      setData((prev) => {
        if (!prev || ea.status === 404) setErr({ msg: ea.message, status: ea.status });
        return prev;
      });
    }
  }, [codigo]);

  useEffect(() => {
    setYoId(leerYo(codigo));
    recargar();
  }, [codigo, recargar]);

  const setYo = useCallback(
    (id: string | null) => {
      guardarYo(codigo, id);
      setYoId(id);
    },
    [codigo],
  );

  const valor = useMemo<GrupoCtx | null>(() => {
    if (!data) return null;
    const porId = new Map(data.miembros.map((m) => [m.id, m]));
    return {
      codigo,
      grupo: data.grupo,
      miembros: data.miembros,
      yo: (yoId && porId.get(yoId)) || null,
      setYo,
      recargar,
      miembro: (id) => porId.get(id),
      nombre: (id) => porId.get(id)?.nombre ?? "?",
    };
  }, [data, yoId, codigo, setYo, recargar]);

  if (err && !data) return <>{error(err.msg, err.status)}</>;
  if (!valor || yoId === undefined) return <>{cargando}</>;
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
