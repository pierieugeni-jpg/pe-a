"use client";

import Link from "next/link";
import { useGrupo } from "@/client/grupo";
import { usePena } from "@/client/pena";
import { Alerta, BotonLink, Chip } from "@/client/ui";
import { formatARS } from "@/lib/montos";

/** P3 · Peña: gastos */
export default function GastosPena() {
  const { codigo, nombre, yo } = useGrupo();
  const { detalle, cuentas, cerrada } = usePena();
  const base = `/g/${codigo}/p/${detalle.pena.id}`;
  const asistentes = [...detalle.asistentes].sort((a, b) => nombre(a).localeCompare(nombre(b), "es"));

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 pb-28 pt-4">
      <div className="flex items-end justify-between rounded-2xl bg-orange-600 p-4 text-white shadow">
        <div>
          <div className="text-sm opacity-90">Total gastado</div>
          <div className="text-3xl font-bold">{formatARS(cuentas.total)}</div>
        </div>
        <div className="text-right text-sm">
          <div className="opacity-90">{cuentas.cantidadAsistentes} asistentes</div>
          <div className="font-semibold">{formatARS(cuentas.costoPorPersona)} c/u</div>
        </div>
      </div>

      {cerrada && (
        <Alerta tipo="info">
          Peña cerrada: no se pueden cargar ni editar gastos.{" "}
          <Link href={`${base}/cuentas`} className="font-semibold underline">
            Reabrir
          </Link>
        </Alerta>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Asistentes</h2>
          {!cerrada && (
            <Link href={`${base}/editar`} className="flex min-h-11 items-center px-2 text-sm font-semibold text-orange-700">
              Editar
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {asistentes.map((id) => (
            <Chip key={id} tono={id === yo?.id ? "yo" : "neutro"}>
              {nombre(id)}
            </Chip>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Gastos ({detalle.gastos.length})</h2>
        {detalle.gastos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 py-10 text-center text-stone-500">
            Todavía no hay gastos.
            {!cerrada && <><br />Tocá “Agregar gasto” para cargar el primero.</>}
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            {detalle.gastos.map((g) => {
              const excluidos = g.participantes ? detalle.asistentes.filter((a) => !g.participantes!.includes(a)) : [];
              const contenido = (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{g.descripcion}</div>
                    {g.conceptos && (
                      <div className="text-sm text-stone-600">
                        {g.conceptos.map((c) => `${c.descripcion} ${formatARS(c.monto_centavos)}`).join(" · ")}
                      </div>
                    )}
                    <div className="truncate text-sm text-stone-500">
                      Pagó {g.pagado_por === yo?.id ? "vos" : nombre(g.pagado_por)}
                      {excluidos.length > 0 && ` · sin ${excluidos.map(nombre).join(", ")}`}
                    </div>
                  </div>
                  <div className="shrink-0 font-semibold">{formatARS(g.monto_centavos)}</div>
                </>
              );
              return (
                <li key={g.id}>
                  {cerrada ? (
                    <div className="flex min-h-14 items-center gap-3 px-4 py-3">{contenido}</div>
                  ) : (
                    <Link href={`${base}/gasto/${g.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-stone-50">
                      {contenido}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!cerrada && (
        <div className="pb-seguro fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-stone-50/95 px-4 pt-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            <BotonLink href={`${base}/gasto/nuevo`} className="w-full text-lg shadow">
              + Agregar gasto
            </BotonLink>
          </div>
        </div>
      )}
    </main>
  );
}
