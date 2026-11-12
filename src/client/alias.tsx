"use client";

import { useState } from "react";
import { api } from "./api";
import { useGrupo } from "./grupo";
import { Alerta, Boton, claseInput, useToast } from "./ui";

/** Formulario chico para que la persona actual cargue o cambie SU alias/CBU. */
export function FormMiAlias({ onListo, onCancelar }: { onListo?: () => void; onCancelar?: () => void }) {
  const { codigo, yo, recargar } = useGrupo();
  const toast = useToast();
  const [alias, setAlias] = useState(yo?.alias_cbu ?? "");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!yo) return null;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api(`/g/${codigo}/miembros/${yo!.id}`, {
        method: "PATCH",
        body: { alias_cbu: alias.trim() || null, editado_por: yo!.id },
      });
      await recargar();
      toast(alias.trim() ? "Alias guardado" : "Alias borrado");
      onListo?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="space-y-2">
      <div className="flex gap-2">
        <input
          className={`${claseInput} min-w-0 flex-1`}
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          maxLength={60}
          placeholder="Tu alias o CBU"
          aria-label="Tu alias o CBU"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        <Boton type="submit" disabled={enviando} className="shrink-0">
          {enviando ? "…" : "Guardar"}
        </Boton>
      </div>
      {onCancelar && (
        <button type="button" onClick={onCancelar} className="min-h-9 text-sm text-stone-500 underline underline-offset-2">
          Cancelar
        </button>
      )}
      {error && <Alerta>{error}</Alerta>}
    </form>
  );
}
