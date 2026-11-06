"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, guardarYo, gruposRecientes, recordarGrupo, type GrupoReciente } from "@/client/api";
import { Alerta, Boton, Campo, claseInput, Tarjeta } from "@/client/ui";
import type { Miembro } from "@/lib/tipos";

export default function Inicio() {
  const router = useRouter();
  const [recientes, setRecientes] = useState<GrupoReciente[]>([]);
  const [nombreGrupo, setNombreGrupo] = useState("");
  const [miNombre, setMiNombre] = useState("");
  const [miAlias, setMiAlias] = useState("");
  const [otros, setOtros] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setRecientes(gruposRecientes()), []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nombres = otros
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const miembros = [{ nombre: miNombre.trim(), alias_cbu: miAlias.trim() || null }, ...nombres.map((nombre) => ({ nombre }))];
    setEnviando(true);
    try {
      const r = await api<{ codigo: string; miembros: Miembro[] }>("/grupos", {
        method: "POST",
        body: { nombre: nombreGrupo, miembros },
      });
      guardarYo(r.codigo, r.miembros[0].id);
      recordarGrupo({ codigo: r.codigo, nombre: nombreGrupo.trim() });
      router.push(`/g/${r.codigo}?nuevo=1`);
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pb-seguro pt-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-orange-600 text-4xl font-bold text-white shadow">÷</div>
        <h1 className="text-2xl font-bold">Peña · Cuentas claras</h1>
        <p className="mt-1 text-stone-600">Cargá lo que gastó cada uno y la app te dice quién le transfiere a quién.</p>
      </div>

      {recientes.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Tus grupos</h2>
          <ul className="space-y-2">
            {recientes.map((g) => (
              <li key={g.codigo}>
                <Link
                  href={`/g/${g.codigo}`}
                  className="flex min-h-14 items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 font-semibold shadow-sm active:bg-stone-100"
                >
                  {g.nombre}
                  <span className="text-stone-400">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Tarjeta>
        <h2 className="mb-3 text-lg font-bold">Crear un grupo</h2>
        <form onSubmit={crear} className="space-y-4">
          <Campo label="Nombre del grupo">
            <input className={claseInput} value={nombreGrupo} onChange={(e) => setNombreGrupo(e.target.value)} maxLength={60} required />
          </Campo>
          <Campo label="Tu nombre">
            <input className={claseInput} value={miNombre} onChange={(e) => setMiNombre(e.target.value)} maxLength={40} required autoComplete="off" />
          </Campo>
          <Campo label="Tu alias o CBU (opcional)" ayuda="Para que te transfieran.">
            <input className={claseInput} value={miAlias} onChange={(e) => setMiAlias(e.target.value)} maxLength={60} autoCapitalize="none" autoComplete="off" />
          </Campo>
          <Campo label="Otros amigos (opcional)" ayuda="Uno por línea. También pueden sumarse solos entrando con el link.">
            <textarea className={`${claseInput} min-h-24`} value={otros} onChange={(e) => setOtros(e.target.value)} />
          </Campo>
          {error && <Alerta>{error}</Alerta>}
          <Boton type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Creando…" : "Crear grupo"}
          </Boton>
        </form>
      </Tarjeta>
      <p className="mt-6 text-center text-sm text-stone-500">¿Te pasaron un link? Abrilo y elegí quién sos.</p>
    </main>
  );
}
