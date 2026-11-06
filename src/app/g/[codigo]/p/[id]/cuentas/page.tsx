"use client";

import { useState } from "react";
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
                      ) : (
                        <span className="flex flex-1 items-center text-sm text-stone-400">{nombre(t.a)} no cargó alias</span>
                      )}
                      <Boton className="shrink-0 text-sm" disabled={cerrada || ocupado !== null} onClick={() => marcar(t)}>
                        {ocupado === clave ? "…" : "Marcar pagada"}
                      </Boton>
                    </div>
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
            <tbody className="divide-y divide-stone-100">
              {cuentas.personas.map((p) => (
                <tr key={p.id} className={p.id === yo?.id ? "bg-orange-50" : ""}>
                  <td className="px-3 py-2.5 font-medium">{quien(p.id)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatARS(p.pagado)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatARS(p.leToca)}</td>
                  <td
                    className={`px-3 py-2.5 text-right font-semibold tabular-nums ${
                      p.saldo > 0 ? "text-green-700" : p.saldo < 0 ? "text-red-700" : "text-stone-500"
                    }`}
                  >
                    {formatARS(p.saldo, { signo: true })}
                    {p.pendiente !== p.saldo && (
                      <div className="text-xs font-normal text-stone-500">
                        {p.pendiente === 0 ? "saldado" : `falta ${formatARS(Math.abs(p.pendiente))}`}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-stone-500">Positivo = le deben. Negativo = debe.</p>
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
          <Boton variante="secundario" className="w-full" disabled={ocupado !== null} onClick={() => cambiarEstado("abierta")}>
            Reabrir peña
          </Boton>
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
