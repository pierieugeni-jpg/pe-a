"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/client/api";
import { useGrupo } from "@/client/grupo";
import { usePena } from "@/client/pena";
import { Alerta, Boton, Campo, ChipCheck, claseInput, Encabezado, useToast } from "@/client/ui";
import { centavosATexto, formatARS, parseMonto, validarMonto } from "@/lib/montos";

const SUGERENCIAS = ["Carne", "Bebidas", "Vino", "Carbón", "Pan", "Hielo", "Verdura", "Postre"];

interface Fila {
  descripcion: string;
  monto: string;
}

/** P4 · Formulario de gasto (nuevo o edición). Un gasto puede tener varios conceptos del mismo ticket. */
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

  const [filas, setFilas] = useState<Fila[]>(() =>
    gasto?.conceptos
      ? gasto.conceptos.map((c) => ({ descripcion: c.descripcion, monto: centavosATexto(c.monto_centavos) }))
      : [{ descripcion: gasto?.descripcion ?? "", monto: gasto ? centavosATexto(gasto.monto_centavos) : "" }],
  );
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

  const varios = filas.length > 1;
  const montos = filas.map((f) => parseMonto(f.monto));
  const total = montos.every((m) => m !== null) ? montos.reduce<number>((s, m) => s + m!, 0) : null;
  const elegidos = participantes.filter((p) => detalle.asistentes.includes(p));
  const todos = elegidos.length === detalle.asistentes.length;

  function toggle(id: string) {
    setParticipantes((x) => (x.includes(id) ? x.filter((p) => p !== id) : [...x, id]));
  }

  const cambiar = (i: number, campo: keyof Fila, valor: string) =>
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  // Cada concepto admite hasta 40 caracteres (la descripción de un gasto simple, 60).
  const agregar = (descripcion = "") =>
    setFilas((fs) => [...fs.map((f) => ({ ...f, descripcion: f.descripcion.slice(0, 40) })), { descripcion, monto: "" }]);
  const quitar = (i: number) => setFilas((fs) => fs.filter((_, j) => j !== i));

  function sugerir(s: string) {
    if (!varios) return cambiar(0, "descripcion", s);
    // Con varios conceptos: completa el último sin nombre, o agrega uno nuevo.
    const vacia = filas.findIndex((f) => !f.descripcion.trim());
    if (vacia >= 0) cambiar(vacia, "descripcion", s);
    else agregar(s);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    for (const [i, f] of filas.entries()) {
      const cual = varios ? ` del concepto ${i + 1}` : "";
      const errMonto = f.monto.trim() === "" ? `Poné el monto${cual}` : validarMonto(montos[i]);
      if (errMonto) return setError(varios && f.monto.trim() !== "" ? `${errMonto}${cual}` : errMonto);
      if (!f.descripcion.trim()) return setError(varios ? `Poné qué es el concepto ${i + 1}` : "Poné una descripción");
    }
    const errTotal = validarMonto(total);
    if (errTotal) return setError(errTotal);
    if (elegidos.length === 0) return setError("Elegí al menos una persona para dividir el gasto");
    setEnviando(true);
    const body = {
      monto_centavos: total,
      // Con varios conceptos la descripción la arma el servidor ("Carne, Vino, Hielo").
      descripcion: varios ? undefined : filas[0].descripcion,
      conceptos: varios ? filas.map((f, i) => ({ descripcion: f.descripcion, monto_centavos: montos[i] })) : null,
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

  const parte = total && elegidos.length ? Math.floor(total / elegidos.length) : 0;

  const chips = (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {SUGERENCIAS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => sugerir(s)}
          className="min-h-9 rounded-full border border-stone-300 bg-white px-3 text-sm text-stone-700 active:bg-stone-100"
        >
          {s}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <Encabezado titulo={esNuevo ? "Nuevo gasto" : "Editar gasto"} sub={detalle.pena.nombre} volver={base} />
      <main className="mx-auto max-w-md px-4 pb-seguro pt-4">
        {cerrada ? (
          <Alerta tipo="info">La peña está cerrada. Reabrila desde Cuentas para cargar o editar gastos.</Alerta>
        ) : (
          <form onSubmit={guardar} className="space-y-5">
            {!varios ? (
              <>
                <Campo label="Monto">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-stone-400">$</span>
                    <input
                      className={`${claseInput} min-h-14 pl-8 text-2xl font-bold`}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      value={filas[0].monto}
                      onChange={(e) => cambiar(0, "monto", e.target.value)}
                      autoFocus={esNuevo}
                      aria-invalid={filas[0].monto !== "" && montos[0] === null}
                    />
                  </div>
                  {filas[0].monto !== "" && montos[0] === null && (
                    <span className="mt-1 block text-xs text-red-700">Escribilo así: 12.500 o 12500,50</span>
                  )}
                </Campo>

                <Campo label="Descripción" ayuda={`${filas[0].descripcion.length}/60`}>
                  <input
                    className={claseInput}
                    value={filas[0].descripcion}
                    onChange={(e) => cambiar(0, "descripcion", e.target.value)}
                    maxLength={60}
                    placeholder="Carne"
                    enterKeyHint="done"
                  />
                  {esNuevo && chips}
                </Campo>

                <button
                  type="button"
                  onClick={() => agregar()}
                  className="-mt-2 min-h-11 text-sm font-semibold text-orange-700"
                >
                  + Agregar otro concepto al mismo ticket
                </button>
              </>
            ) : (
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-stone-700">Conceptos</legend>
                <ul className="space-y-2">
                  {filas.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <input
                        className={`${claseInput} min-w-0 flex-1`}
                        value={f.descripcion}
                        onChange={(e) => cambiar(i, "descripcion", e.target.value)}
                        maxLength={40}
                        placeholder={`Concepto ${i + 1}`}
                        aria-label={`Concepto ${i + 1}`}
                      />
                      <div className="relative w-32 shrink-0">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                        <input
                          className={`${claseInput} pl-7 text-right font-semibold`}
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0"
                          value={f.monto}
                          onChange={(e) => cambiar(i, "monto", e.target.value)}
                          aria-label={`Monto del concepto ${i + 1}`}
                          aria-invalid={f.monto !== "" && montos[i] === null}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => quitar(i)}
                        className="flex min-h-11 w-9 shrink-0 items-center justify-center rounded-xl text-xl text-stone-400 active:bg-stone-100"
                        aria-label={`Quitar concepto ${i + 1}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => agregar()} className="mt-1 min-h-11 text-sm font-semibold text-orange-700">
                  + Agregar concepto
                </button>
                {chips}
                <div className="mt-3 flex items-baseline justify-between rounded-xl bg-orange-50 px-3 py-2">
                  <span className="text-sm font-medium text-stone-700">Total del ticket</span>
                  <span className="text-2xl font-bold">{total !== null ? formatARS(total) : "—"}</span>
                </div>
              </fieldset>
            )}

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
