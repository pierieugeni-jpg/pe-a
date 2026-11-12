"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormMiAlias } from "@/client/alias";
import { api, copiar, guardarYo } from "@/client/api";
import { useGrupo } from "@/client/grupo";
import { Alerta, Boton, BotonLink, Cargando, Encabezado, EstadoBadge, Tarjeta, usePolling, useToast } from "@/client/ui";
import { fechaLarga, formatARS } from "@/lib/montos";
import type { PenaResumen } from "@/lib/tipos";

/** P2 · Inicio del grupo: lista de peñas. */
export default function InicioGrupo() {
  const { grupo, codigo, yo } = useGrupo();
  const toast = useToast();
  const [penas, setPenas] = useState<PenaResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [esNuevo, setEsNuevo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setPenas(await api<PenaResumen[]>(`/g/${codigo}/penas`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [codigo]);

  useEffect(() => {
    cargar();
    setEsNuevo(new URLSearchParams(location.search).has("nuevo"));
  }, [cargar]);
  usePolling(cargar, 30_000, true);

  const router = useRouter();
  const link = typeof window !== "undefined" ? `${location.origin}/g/${codigo}` : "";

  function cerrarSesion() {
    if (!confirm(`¿Cerrar sesión como ${yo?.nombre}? Para volver a entrar vas a elegir quién sos de nuevo.`)) return;
    // Solo se borra del navegador; se navega antes de tocar el estado para no rebotar a /entrar.
    guardarYo(codigo, null);
    router.replace("/");
  }

  async function copiarLink() {
    toast((await copiar(link)) ? "Link copiado" : "No se pudo copiar");
  }

  function compartirLink() {
    const texto = `Sumate a "${grupo.nombre}" para dividir los gastos de la peña: ${link}`;
    if (navigator.share) navigator.share({ title: grupo.nombre, text: texto }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  }

  return (
    <>
      <Encabezado
        titulo={grupo.nombre}
        sub={
          <Link href={`/g/${codigo}/entrar`} className="underline decoration-stone-300 underline-offset-2">
            Sos {yo?.nombre} · cambiar
          </Link>
        }
        derecha={
          <div className="flex shrink-0 items-center">
            <Link href={`/g/${codigo}/miembros`} className="flex min-h-11 items-center rounded-xl px-2.5 text-sm font-semibold text-orange-700 active:bg-orange-50">
              Miembros
            </Link>
            <button
              type="button"
              onClick={cerrarSesion}
              className="flex min-h-11 items-center rounded-xl px-2.5 text-sm font-semibold text-stone-600 active:bg-stone-200"
            >
              Salir
            </button>
          </div>
        }
      />
      <main className="mx-auto max-w-md space-y-4 px-4 pb-seguro pt-4">
        {esNuevo && (
          <Tarjeta className="border-orange-200 bg-orange-50">
            <p className="mb-3 font-semibold">¡Grupo creado! Pasales el link a tus amigos.</p>
            <div className="flex gap-2">
              <Boton className="flex-1" onClick={compartirLink}>
                Compartir
              </Boton>
              <Boton variante="secundario" className="flex-1" onClick={copiarLink}>
                Copiar link
              </Boton>
            </div>
          </Tarjeta>
        )}

        {yo && !yo.alias_cbu && (
          <Tarjeta className="border-amber-200 bg-amber-50">
            <p className="mb-1 font-semibold">Cargá tu alias o CBU</p>
            <p className="mb-3 text-sm text-stone-600">Así los demás pueden copiarlo cuando te tengan que transferir.</p>
            <FormMiAlias />
          </Tarjeta>
        )}

        <div className="flex gap-2">
          <BotonLink href={`/g/${codigo}/nueva`} className="flex-1">
            + Nueva peña
          </BotonLink>
          {!esNuevo && (
            <Boton variante="secundario" onClick={copiarLink}>
              Copiar link
            </Boton>
          )}
        </div>

        {error && <Alerta>{error}</Alerta>}
        {!penas && !error && <Cargando />}
        {penas && penas.length === 0 && (
          <p className="py-12 text-center text-stone-500">Todavía no hay peñas. ¡Armá la primera!</p>
        )}

        <ul className="space-y-3">
          {penas?.map((p) => {
            const fui = yo ? p.asistentes.includes(yo.id) : false;
            const saldo = yo ? (p.saldos[yo.id] ?? 0) : 0;
            return (
              <li key={p.id}>
                <Link href={`/g/${codigo}/p/${p.id}`} className="block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm active:bg-stone-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold">{p.nombre}</div>
                      <div className="text-sm text-stone-500">
                        {fechaLarga(p.fecha)}
                        {p.lugar ? ` · ${p.lugar}` : ""}
                      </div>
                    </div>
                    <EstadoBadge estado={p.estado} />
                  </div>
                  <div className="mt-3 flex items-end justify-between text-sm">
                    <div>
                      <div className="text-stone-500">Total</div>
                      <div className="font-semibold">{formatARS(p.total)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-stone-500">Tu saldo</div>
                      {!fui ? (
                        <div className="text-stone-400">No fuiste</div>
                      ) : saldo === 0 ? (
                        <div className="font-semibold text-stone-700">Al día</div>
                      ) : saldo > 0 ? (
                        <div className="font-semibold text-green-700">Te deben {formatARS(saldo)}</div>
                      ) : (
                        <div className="font-semibold text-red-700">Debés {formatARS(-saldo)}</div>
                      )}
                    </div>
                  </div>
                  {p.transferencias_pendientes > 0 && p.total > 0 && (
                    <div className="mt-2 text-xs font-medium text-amber-700">
                      {p.transferencias_pendientes === 1 ? "1 transferencia pendiente" : `${p.transferencias_pendientes} transferencias pendientes`}
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
