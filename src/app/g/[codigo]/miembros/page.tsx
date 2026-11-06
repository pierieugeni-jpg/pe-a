"use client";

import { useState } from "react";
import { api, copiar } from "@/client/api";
import { useGrupo } from "@/client/grupo";
import { Alerta, Boton, Campo, claseInput, Encabezado, Tarjeta, useToast } from "@/client/ui";
import type { Miembro } from "@/lib/tipos";

/** P6 · Miembros */
export default function Miembros() {
  const { miembros, codigo, yo, recargar } = useGrupo();
  const toast = useToast();
  const [editando, setEditando] = useState<string | "nuevo" | null>(null);
  const activos = miembros.filter((m) => m.activo);
  const inactivos = miembros.filter((m) => !m.activo);

  async function cambiarActivo(m: Miembro, activo: boolean) {
    if (!activo && !confirm(`¿Desactivar a ${m.nombre}? No se borra: sigue apareciendo en las peñas viejas.`)) return;
    try {
      await api(`/g/${codigo}/miembros/${m.id}`, { method: "PATCH", body: { activo } });
      await recargar();
      toast(activo ? `${m.nombre} reactivado` : `${m.nombre} desactivado`);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <>
      <Encabezado titulo="Miembros" sub={`${activos.length} activos`} volver={`/g/${codigo}`} />
      <main className="mx-auto max-w-md space-y-3 px-4 pb-seguro pt-4">
        {editando === "nuevo" ? (
          <FormMiembro onListo={() => setEditando(null)} />
        ) : (
          <Boton className="w-full" onClick={() => setEditando("nuevo")}>
            + Agregar miembro
          </Boton>
        )}

        <ul className="space-y-2">
          {activos.map((m) =>
            editando === m.id ? (
              <li key={m.id}>
                <FormMiembro miembro={m} onListo={() => setEditando(null)} onDesactivar={() => cambiarActivo(m, false)} />
              </li>
            ) : (
              <li key={m.id} className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {m.nombre} {yo?.id === m.id && <span className="text-sm font-normal text-orange-700">(vos)</span>}
                  </div>
                  {m.alias_cbu ? (
                    <button
                      type="button"
                      className="min-h-8 truncate text-left text-sm text-stone-600 underline decoration-dotted underline-offset-2"
                      onClick={async () => toast((await copiar(m.alias_cbu!)) ? "Alias copiado" : "No se pudo copiar")}
                    >
                      {m.alias_cbu}
                    </button>
                  ) : (
                    <div className="text-sm text-stone-400">Sin alias</div>
                  )}
                </div>
                <Boton variante="fantasma" onClick={() => setEditando(m.id)}>
                  Editar
                </Boton>
              </li>
            ),
          )}
        </ul>

        {inactivos.length > 0 && (
          <section className="pt-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Desactivados</h2>
            <ul className="space-y-2">
              {inactivos.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-100 p-3">
                  <div className="flex-1 text-stone-600">{m.nombre}</div>
                  <Boton variante="fantasma" onClick={() => cambiarActivo(m, true)}>
                    Reactivar
                  </Boton>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function FormMiembro({ miembro, onListo, onDesactivar }: { miembro?: Miembro; onListo: () => void; onDesactivar?: () => void }) {
  const { codigo, recargar, yo } = useGrupo();
  const toast = useToast();
  const [nombre, setNombre] = useState(miembro?.nombre ?? "");
  const [alias, setAlias] = useState(miembro?.alias_cbu ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const body = { nombre, alias_cbu: alias || null };
      if (miembro) await api(`/g/${codigo}/miembros/${miembro.id}`, { method: "PATCH", body });
      else await api(`/g/${codigo}/miembros`, { method: "POST", body });
      await recargar();
      toast(miembro ? "Guardado" : `${nombre.trim()} agregado`);
      onListo();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Tarjeta className="border-orange-200">
      <form onSubmit={guardar} className="space-y-3">
        <Campo label="Nombre">
          <input className={claseInput} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} required autoFocus />
        </Campo>
        <Campo label="Alias o CBU (opcional)">
          <input className={claseInput} value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={60} autoCapitalize="none" />
        </Campo>
        {error && <Alerta>{error}</Alerta>}
        <div className="flex gap-2">
          <Boton variante="secundario" className="flex-1" onClick={onListo}>
            Cancelar
          </Boton>
          <Boton type="submit" className="flex-1" disabled={enviando}>
            Guardar
          </Boton>
        </div>
        {miembro && onDesactivar && miembro.id !== yo?.id && (
          <Boton variante="peligro" className="w-full" onClick={onDesactivar}>
            Desactivar
          </Boton>
        )}
      </form>
    </Tarjeta>
  );
}
