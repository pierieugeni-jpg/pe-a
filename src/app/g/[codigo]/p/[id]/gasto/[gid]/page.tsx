"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/client/api";
import { useGrupo } from "@/client/grupo";
import { usePena } from "@/client/pena";
import { Alerta, Boton, Campo, ChipCheck, claseInput, Encabezado, useToast } from "@/client/ui";
import { centavosATexto, formatARS, parseMonto, validarMonto } from "@/lib/montos";

const SUGERENCIAS = ["Carne", "Bebidas", "Vino", "Carbón", "Pan", "Hielo", "Verdura", "Postre"];

/** P4 · Formulario de gasto (nuevo o edición) */
export default function FormGasto() {
  const { gid } = useParams<{ gid: string }>();
  const { codigo, nombre, yo } = useGrupo();
  const { detalle, cerrada, recargar } = usePena();
  const router = useRouter();
  const toast = useToast();
  const base = `/g/${codigo}/p/${detalle.pena.id}`;
  const esNuevo = gid === "nuevo";
  const gasto = esNuevo ? null : detalle.gastos.find((g) => g.id === gid);

  const asistentes = useMemo(
    () => [...detalle.asistentes].sort((a, b) => nombre(a).localeCompare(nombre(b), "es")),
    [detalle.asistentes, nombre],
  );

  const [montoTxt, setMontoTxt] = useState(gasto ? centavosATexto(gasto.monto_centavos) : "");
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? "");
  const [pagadoPor, setPagadoPor] = useState(
    gasto?.pagado_por ?? (yo && detalle.asistentes.includes(yo.id) ? yo.id : (asistentes[0] ?? "")),
  );
  const [participantes, setParticipantes] = useState<string[]>(gasto?.participantes ?? detalle.asistentes);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!esNuevo && !gasto) {
    return (
      <>
        <Encabezado titulo="Gasto" volver={base} />
        <main className="mx-auto max-w-md p-4">
          <Alerta>Este gasto ya no existe (quizás alguien lo borró).</Alerta>
        </main>
      </>
    );
  }

  const centavos = parseMonto(montoTxt);
  const elegidos = participantes.filter((p) => detalle.asistentes.includes(p));
  const todos = elegidos.length === detalle.asistentes.length;

  function toggle(id: string) {
    setParticipantes((x) => (x.includes(id) ? x.filter((p) => p !== id) : [...x, id]));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errMonto = montoTxt.trim() === "" ? "Poné el monto" : validarMonto(centavos);
    if (errMonto) return setError(errMonto);
    if (!descripcion.trim()) return setError("Poné una descripción");
    if (elegidos.length === 0) return setError("Elegí al menos una persona para dividir el gasto");
    setEnviando(true);
    const body = {
      monto_centavos: centavos,
      descripcion,
      pagado_por: pagadoPor,
      participantes: todos ? null : elegidos,
      creado_por: yo?.id,
    };
    try {
      if (esNuevo) await api(`/g/${codigo}/penas/${detalle.pena.id}/gastos`, { method: "POST", body });
      else await api(`/g/${codigo}/gastos/${gid}`, { method: "PATCH", body });
      await recargar();
      toast(esNuevo ? "Gasto cargado" : "Gasto guardado");
      router.replace(base);
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  async function borrar() {
    if (!confirm(`¿Borrar "${gasto!.descripcion}"?`)) return;
    setEnviando(true);
    try {
      await api(`/g/${codigo}/gastos/${gid}`, { method: "DELETE" });
      await recargar();
      toast("Gasto borrado");
      router.replace(base);
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  const parte = centavos && elegidos.length ? Math.floor(centavos / elegidos.length) : 0;

  return (
    <>
      <Encabezado titulo={esNuevo ? "Nuevo gasto" : "Editar gasto"} sub={detalle.pena.nombre} volver={base} />
      <main className="mx-auto max-w-md px-4 pb-seguro pt-4">
        {cerrada ? (
          <Alerta tipo="info">La peña está cerrada. Reabrila desde Cuentas para cargar o editar gastos.</Alerta>
        ) : (
          <form onSubmit={guardar} className="space-y-5">
            <Campo label="Monto">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-stone-400">$</span>
                <input
                  className={`${claseInput} min-h-14 pl-8 text-2xl font-bold`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={montoTxt}
                  onChange={(e) => setMontoTxt(e.target.value)}
                  autoFocus={esNuevo}
                  aria-invalid={montoTxt !== "" && centavos === null}
                />
              </div>
              {montoTxt !== "" && centavos === null && <span className="mt-1 block text-xs text-red-700">Escribilo así: 12.500 o 12500,50</span>}
            </Campo>

            <Campo label="Descripción" ayuda={`${descripcion.length}/60`}>
              <input className={claseInput} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={60} placeholder="Carne" enterKeyHint="done" />
              {esNuevo && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {SUGERENCIAS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDescripcion(s)}
                      className="min-h-9 rounded-full border border-stone-300 bg-white px-3 text-sm text-stone-700 active:bg-stone-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </Campo>

            <Campo label="¿Quién pagó?">
              <select className={claseInput} value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)}>
                {asistentes.map((id) => (
                  <option key={id} value={id}>
                    {nombre(id)}
                    {id === yo?.id ? " (vos)" : ""}
                  </option>
                ))}
              </select>
            </Campo>

            <fieldset>
              <div className="mb-2 flex items-center justify-between">
                <legend className="text-sm font-medium text-stone-700">¿Entre quiénes se divide?</legend>
                <button type="button" className="min-h-11 px-2 text-sm font-semibold text-orange-700" onClick={() => setParticipantes(todos ? [] : detalle.asistentes)}>
                  {todos ? "Ninguno" : "Todos"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {asistentes.map((id) => (
                  <ChipCheck key={id} activo={elegidos.includes(id)} onClick={() => toggle(id)}>
                    {nombre(id)}
                  </ChipCheck>
                ))}
              </div>
              <p className="mt-2 text-sm text-stone-600">
                {elegidos.length === 0
                  ? "Elegí al menos una persona."
                  : `${todos ? "Entre todos" : `Entre ${elegidos.length}`}${parte ? `: ${formatARS(parte)} c/u` : ""}`}
              </p>
            </fieldset>

            {error && <Alerta>{error}</Alerta>}

            <div className="flex gap-2">
              <Boton variante="secundario" className="flex-1" onClick={() => router.replace(base)}>
                Cancelar
              </Boton>
              <Boton type="submit" className="flex-[2]" disabled={enviando}>
                {enviando ? "Guardando…" : "Guardar"}
              </Boton>
            </div>
            {!esNuevo && (
              <Boton variante="peligro" className="w-full" onClick={borrar} disabled={enviando}>
                Borrar gasto
              </Boton>
            )}
            {gasto && (
              <p className="text-center text-xs text-stone-500">
                Cargado por {gasto.creado_por ? nombre(gasto.creado_por) : "?"}
                {gasto.editado_en ? " · editado" : ""}
              </p>
            )}
          </form>
        )}
      </main>
    </>
  );
}
