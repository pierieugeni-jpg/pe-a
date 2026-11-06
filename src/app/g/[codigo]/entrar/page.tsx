"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/client/api";
import { useGrupo } from "@/client/grupo";
import { Alerta, Boton, Campo, claseInput, Encabezado, Tarjeta } from "@/client/ui";
import type { Miembro } from "@/lib/tipos";

/** P1 · Entrada al grupo: elegir "Soy…" o agregarse. */
export default function Entrar() {
  const { grupo, miembros, codigo, yo, setYo, recargar } = useGrupo();
  const router = useRouter();
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [alias, setAlias] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const activos = miembros.filter((m) => m.activo);

  function elegir(id: string) {
    setYo(id);
    router.replace(`/g/${codigo}`);
  }

  async function agregarme(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const m = await api<Miembro>(`/g/${codigo}/miembros`, { method: "POST", body: { nombre, alias_cbu: alias || null } });
      await recargar();
      elegir(m.id);
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <>
      <Encabezado titulo={grupo.nombre} sub="¿Quién sos?" volver={yo ? `/g/${codigo}` : undefined} />
      <main className="mx-auto max-w-md space-y-4 px-4 pb-seguro pt-4">
        {activos.length > 0 && (
          <ul className="grid grid-cols-2 gap-2">
            {activos.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => elegir(m.id)}
                  className={`flex min-h-14 w-full items-center justify-center rounded-2xl border px-3 text-base font-semibold shadow-sm active:bg-orange-50 ${
                    yo?.id === m.id ? "border-orange-500 bg-orange-50 text-orange-800" : "border-stone-200 bg-white"
                  }`}
                >
                  Soy {m.nombre}
                </button>
              </li>
            ))}
          </ul>
        )}

        {!nuevo ? (
          <Boton variante="secundario" className="w-full" onClick={() => setNuevo(true)}>
            No estoy en la lista, agregarme
          </Boton>
        ) : (
          <Tarjeta>
            <form onSubmit={agregarme} className="space-y-4">
              <h2 className="text-lg font-bold">Agregarme al grupo</h2>
              <Campo label="Tu nombre">
                <input className={claseInput} value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} required autoFocus />
              </Campo>
              <Campo label="Alias o CBU (opcional)" ayuda="Para que te puedan transferir.">
                <input className={claseInput} value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={60} autoCapitalize="none" />
              </Campo>
              {error && <Alerta>{error}</Alerta>}
              <Boton type="submit" className="w-full" disabled={enviando}>
                {enviando ? "Agregando…" : "Agregarme y entrar"}
              </Boton>
            </form>
          </Tarjeta>
        )}
        <p className="text-center text-xs text-stone-500">Tu elección se recuerda en este dispositivo.</p>
      </main>
    </>
  );
}
