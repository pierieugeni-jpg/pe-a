"use client";

import { useRouter } from "next/navigation";
import { api, hoy } from "@/client/api";
import { useGrupo } from "@/client/grupo";
import { PenaForm } from "@/client/pena-form";
import { Encabezado } from "@/client/ui";
import type { Pena } from "@/lib/tipos";

export default function NuevaPena() {
  const { codigo, miembros, yo } = useGrupo();
  const router = useRouter();
  return (
    <>
      <Encabezado titulo="Nueva peña" volver={`/g/${codigo}`} />
      <main className="mx-auto max-w-md px-4 pb-seguro pt-4">
        <PenaForm
          inicial={{ nombre: "", fecha: hoy(), lugar: "", asistentes: miembros.filter((m) => m.activo).map((m) => m.id) }}
          textoGuardar="Crear peña"
          onCancelar={() => router.back()}
          onGuardar={async (d) => {
            const p = await api<Pena>(`/g/${codigo}/penas`, {
              method: "POST",
              body: { nombre: d.nombre || null, fecha: d.fecha, lugar: d.lugar || null, asistentes: d.asistentes, creado_por: yo?.id },
            });
            router.replace(`/g/${codigo}/p/${p.id}`);
          }}
        />
      </main>
    </>
  );
}
