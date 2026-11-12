"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormMiAlias } from "@/client/alias";
import { api, copiar } from "@/client/api";
import { useGrupo } from "@/client/grupo";
import { usePena } from "@/client/pena";
import { Alerta, Boton, Tarjeta, useToast } from "@/client/ui";
import type { Transferencia } from "@/lib/cuentas";
import { formatARS } from "@/lib/montos";
import { resumenWhatsApp } from "@/lib/resumen";
import type { PenaDetalle } from "@/lib/tipos";

/** P5 · Peña: cuentas */
export default function Cuentas() {
  const { codigo, nombre, miembro, miembros, yo } = useGrupo();
  const { detalle, cuentas, cerrada, recargar, setDetalle } = usePena();
  const toast = useToast();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargandoAlias, setCargandoAlias] = useState(false);
  const penaUrl = `/g/${codigo}/penas/${detalle.pena.id}`;
  const quien = (id: string) => (id === yo?.id ? "Vos" : nombre(id));

  async function accion(clave: string, fn: () => Promise<unknown>, ok: string) {
    setOcupado(clave);
    setError(null);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      await recargar();
      setOcupado(null);
    }
  }

  const marcar = (t: Transferencia) =>
    accion(
      `t:${t.de}:${t.a}`,
      () => api(`${penaUrl}/pagos`, { method: "POST", body: { de_miembro_id: t.de, a_miembro_id: t.a, monto_centavos: t.monto } }),
      "Marcada como pagada",
    );

  const desmarcar = (pagoId: string) =>
    accion(`p:${pagoId}`, () => api(`${penaUrl}/pagos/${pagoId}`, { method: "DELETE" }), "Pago desmarcado");

  const cambiarEstado = (estado: "abierta" | "cerrada") =>
    accion(
      "estado",
      async () => setDetalle(await api<PenaDetalle>(penaUrl, { method: "PATCH", body: { estado } })),
      estado === "cerrada" ? "Peña cerrada" : "Peña reabierta",
    );

  const router = useRouter();

  async function eliminar() {
    if (!confirm(`¿Eliminar "${detalle.pena.nombre}"? Se borran sus gastos y pagos, y no se puede deshacer.`)) return;
    setOcupado("eliminar");
    setError(null);
    try {
      await api(penaUrl, { method: "DELETE" });
      toast("Peña eliminada");
      router.replace(`/g/${codigo}`);
    } catch (e) {
      setError((e as Error).message);
      setOcupado(null);
    }
  }

  const resumen = resumenWhatsApp(detalle.pena, cuentas, miembros);

  return (
    <main className="mx-auto max-w-md space-y-5 px-4 pb-seguro pt-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Dato titulo="Total" valor={formatARS(cuentas.total)} />
        <Dato titulo="Asistentes" valor={String(cuentas.cantidadAsistentes)} />
        <Dato titulo="Por persona" valor={formatARS(cuentas.costoPorPersona)} />
      </div>

      {error && <Alerta>{error}</Alerta>}

      {/* Transferencias pendientes */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
          {cuentas.saldado ? "Transferencias" : `Falta transferir (${cuentas.transferencias.length})`}
        </h2>
        {cuentas.saldado ? (
          <Alerta tipo="ok">{cuentas.total === 0 ? "No hay gastos cargados." : "¡Todo saldado! Nadie le debe nada a nadie."}</Alerta>
        ) : (
          <ul className="space-y-2">
            {cuentas.transferencias.map((t) => {
              const alias = miembro(t.a)?.alias_cbu;
              const mia = t.de === yo?.id;
              const clave = `t:${t.de}:${t.a}`;
              return (
                <li key={clave}>
                  <Tarjeta className={mia ? "border-orange-300 ring-2 ring-orange-100" : ""}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 text-base">
                        <span className="font-semibold">{quien(t.de)}</span>
                        <span className="mx-1.5 text-stone-400">→</span>
                        <span className="font-semibold">{quien(t.a)}</span>
                      </div>
                      <div className="shrink-0 text-lg font-bold">{formatARS(t.monto)}</div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {alias ? (
                        <Boton
                          variante="secundario"
                          className="min-w-0 flex-1 text-sm"
                          onClick={async () => toast((await copiar(alias)) ? `Alias copiado: ${alias}` : "No se pudo copiar")}
                        >
                          <span className="truncate">{alias}</span>
                          <span aria-hidden>⧉</span>
                        </Boton>
                      ) : t.a === yo?.id ? (
                        <Boton variante="secundario" className="min-w-0 flex-1 text-sm" onClick={() => setCargandoAlias(true)}>
                          + Cargar mi alias
                        </Boton>
                      ) : (
                        <span className="flex flex-1 items-center text-sm text-stone-400">{nombre(t.a)} no cargó alias</span>
                      )}
                      <Boton className="shrink-0 text-sm" disabled={cerrada || ocupado !== null} onClick={() => marcar(t)}>
                        {ocupado === clave ? "…" : "Marcar pagada"}
                      </Boton>
                    </div>
                    {cargandoAlias && t.a === yo?.id && !alias && (
                      <div className="mt-3">
                        <FormMiAlias onListo={() => setCargandoAlias(false)} onCancelar={() => setCargandoAlias(false)} />
                      </div>
                    )}
                  </Tarjeta>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Pagos ya marcados */}
      {detalle.pagos.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Ya pagado</h2>
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
            {detalle.pagos.map((p) => (
              <li key={p.id} className="flex min-h-14 items-center gap-2 px-4 py-2">
                <span className="text-green-700" aria-hidden>
                  ✓
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  {quien(p.de_miembro_id)} → {quien(p.a_miembro_id)} <span className="font-semibold">{formatARS(p.monto_centavos)}</span>
                </div>
                {!cerrada && (
                  <Boton variante="fantasma" className="text-sm" disabled={ocupado !== null} onClick={() => desmarcar(p.id)}>
                    Desmarcar
                  </Boton>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Saldos */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Saldo de cada uno</h2>
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Nombre</th>
                <th className="px-2 py-2 text-right font-medium">Pagó</th>
                <th className="px-2 py-2 text-right font-medium">Le toca</th>
                <th className="px-3 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {cuentas.personas.map((p) => {
                // Fila completa: verde = le falta cobrar, roja = le falta pagar, blanca = saldado.
                const fila =
                  p.pendiente > 0 ? "bg-green-700 text-white" : p.pendiente < 0 ? "bg-red-700 text-white" : "bg-white text-stone-700";
                const pendienteVisible = p.pendiente !== p.saldo;
                return (
                  <tr key={p.id} className={fila}>
                    <td className="px-3 py-2.5 font-medium">
                      {quien(p.id)}
                      {p.pendiente !== 0 && (
                        <div className="text-xs font-normal opacity-90">{p.pendiente > 0 ? "Cobra" : "Paga"}</div>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatARS(p.pagado)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatARS(p.leToca)}</td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                      {formatARS(p.saldo, { signo: true })}
                      {pendienteVisible && (
                        <div className="text-xs font-normal opacity-90">
                          {p.pendiente === 0 ? "saldado" : `falta ${formatARS(Math.abs(p.pendiente))}`}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-green-700" /> Tiene que cobrar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-red-700" /> Tiene que pagar
          </span>
        </p>
      </section>

      {/* Acciones */}
      <section className="space-y-2">
        <Boton
          variante="secundario"
          className="w-full"
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(resumen)}`, "_blank")}
        >
          Compartir resumen por WhatsApp
        </Boton>
        <Boton variante="fantasma" className="w-full text-sm" onClick={async () => toast((await copiar(resumen)) ? "Resumen copiado" : "No se pudo copiar")}>
          Copiar resumen
        </Boton>
        {cerrada ? (
          <>
            <Boton variante="secundario" className="w-full" disabled={ocupado !== null} onClick={() => cambiarEstado("abierta")}>
              Reabrir peña
            </Boton>
            <Boton variante="peligro" className="w-full" disabled={ocupado !== null} onClick={eliminar}>
              {ocupado === "eliminar" ? "Eliminando…" : "Eliminar peña"}
            </Boton>
          </>
        ) : (
          <>
            <Boton className="w-full" disabled={!cuentas.saldado || ocupado !== null} onClick={() => cambiarEstado("cerrada")}>
              Cerrar peña
            </Boton>
            {!cuentas.saldado && <p className="text-center text-xs text-stone-500">Se puede cerrar cuando todas las transferencias estén pagadas.</p>}
          </>
        )}
      </section>
    </main>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-2 py-3 shadow-sm">
      <div className="text-xs text-stone-500">{titulo}</div>
      <div className="truncate text-base font-bold">{valor}</div>
    </div>
  );
}
