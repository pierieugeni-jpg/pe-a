"use client";

import { useState } from "react";
import type { Miembro } from "@/lib/tipos";
import { api } from "./api";
import { useGrupo } from "./grupo";
import { Alerta, Boton, Campo, ChipCheck, claseInput } from "./ui";

export interface DatosPena {
  nombre: string;
  fecha: string;
  lugar: string;
  asistentes: string[];
}

/** Formulario de datos + asistentes, para crear o editar una peña. */
export function PenaForm({
  inicial,
  textoGuardar,
  onGuardar,
  onCancelar,
  asistentesFijos = [],
}: {
  inicial: DatosPena;
  textoGuardar: string;
  onGuardar: (d: DatosPena) => Promise<void>;
  onCancelar: () => void;
  /** Miembros que pagaron algo: se avisa antes de sacarlos. */
  asistentesFijos?: string[];
}) {
  const { miembros, codigo, recargar, nombre: nombreDe } = useGrupo();
  const [d, setD] = useState<DatosPena>(inicial);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [agregando, setAgregando] = useState(false);

  // Activos + inactivos que ya estaban en la peña.
  const visibles = miembros.filter((m) => m.activo || inicial.asistentes.includes(m.id));
  const todos = visibles.every((m) => d.asistentes.includes(m.id));

  function toggle(id: string) {
    setError(null);
    if (d.asistentes.includes(id) && asistentesFijos.includes(id)) {
      setError(`${nombreDe(id)} pagó un gasto de esta peña. Reasigná o borrá ese gasto antes de sacarlo.`);
      return;
    }
    setD((x) => ({ ...x, asistentes: x.asistentes.includes(id) ? x.asistentes.filter((a) => a !== id) : [...x.asistentes, id] }));
  }

  async function agregarMiembro() {
    if (!nuevoNombre.trim()) return;
    setAgregando(true);
    setError(null);
    try {
      const m = await api<Miembro>(`/g/${codigo}/miembros`, { method: "POST", body: { nombre: nuevoNombre } });
      await recargar();
      setD((x) => ({ ...x, asistentes: [...x.asistentes, m.id] }));
      setNuevoNombre("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAgregando(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (d.asistentes.length === 0) return setError("Marcá al menos un asistente.");
    setEnviando(true);
    try {
      await onGuardar(d);
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha">
          <input type="date" className={claseInput} value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} required />
        </Campo>
        <Campo label="Lugar (opcional)">
          <input className={claseInput} value={d.lugar} onChange={(e) => setD({ ...d, lugar: e.target.value })} placeholder="Lo de Ana" maxLength={60} />
        </Campo>
      </div>
      <Campo label="Nombre (opcional)">
        <input className={claseInput} value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} placeholder="Peña del sábado" maxLength={60} />
      </Campo>

      <fieldset>
        <div className="mb-2 flex items-center justify-between">
          <legend className="text-sm font-medium text-stone-700">
            ¿Quiénes van? <span className="text-stone-500">({d.asistentes.length})</span>
          </legend>
          <button
            type="button"
            className="min-h-11 px-2 text-sm font-semibold text-orange-700"
            onClick={() => {
              setError(null);
              setD({
                ...d,
                asistentes: todos ? d.asistentes.filter((id) => asistentesFijos.includes(id)) : visibles.map((m) => m.id),
              });
            }}
          >
            {todos ? "Ninguno" : "Todos"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibles.map((m) => (
            <ChipCheck key={m.id} activo={d.asistentes.includes(m.id)} onClick={() => toggle(m.id)}>
              {m.nombre}
            </ChipCheck>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className={claseInput}
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregarMiembro();
              }
            }}
            placeholder="¿Cayó alguien más? Nombre"
            maxLength={40}
          />
          <Boton variante="secundario" onClick={agregarMiembro} disabled={agregando || !nuevoNombre.trim()}>
            Sumar
          </Boton>
        </div>
      </fieldset>

      {error && <Alerta>{error}</Alerta>}
      <div className="flex gap-2 pt-2">
        <Boton variante="secundario" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" className="flex-1" disabled={enviando}>
          {enviando ? "Guardando…" : textoGuardar}
        </Boton>
      </div>
    </form>
  );
}
