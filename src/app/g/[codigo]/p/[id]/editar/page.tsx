"use client";

import { useRouter } from "next/navigation";
import { api } from "@/client/api";
import { useGrupo } from "@/client/grupo";
import { usePena } from "@/client/pena";
import { PenaForm } from "@/client/pena-form";
import { Alerta, Encabezado, useToast } from "@/client/ui";
import type { PenaDetalle } from "@/lib/tipos";

export default function EditarPena() {
  const { codigo } = useGrupo();
  const { detalle, cerrada, setDetalle } = usePena();
  const router = useRouter();
  const toast = useToast();
  const base = `/g/${codigo}/p/${detalle.pena.id}`;
  const p = detalle.pena;
  return (
    <>
      <Encabezado titulo="Editar peña" sub={p.nombre} volver={base} />
      <main className="mx-auto max-w-md px-4 pb-seguro pt-4">
        {cerrada ? (
          <Alerta tipo="info">La peña está cerrada. Reabrila desde Cuentas para editarla.</Alerta>
        ) : (
          <PenaForm
            inicial={{ nombre: p.nombre, fecha: p.fecha, lugar: p.lugar ?? "", asistentes: detalle.asistentes }}
            asistentesFijos={[...new Set(detalle.gastos.map((g) => g.pagado_por))]}
            textoGuardar="Guardar"
            onCancelar={() => router.replace(base)}
            onGuardar={async (d) => {
              const nuevo = await api<PenaDetalle>(`/g/${codigo}/penas/${p.id}`, {
                method: "PATCH",
                body: { nombre: d.nombre.trim() || p.nombre, fecha: d.fecha, lugar: d.lugar || null, asistentes: d.asistentes },
              });
              setDetalle(nuevo);
              toast("Peña actualizada");
              router.replace(base);
            }}
          />
        )}
      </main>
    </>
  );
}
