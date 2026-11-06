"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { GrupoProvider, useGrupo } from "@/client/grupo";
import { Alerta, Cargando } from "@/client/ui";

function ExigirIdentidad({ children }: { children: ReactNode }) {
  const { yo, codigo } = useGrupo();
  const path = usePathname();
  const router = useRouter();
  const enEntrada = path.endsWith("/entrar");
  useEffect(() => {
    if (!yo && !enEntrada) router.replace(`/g/${codigo}/entrar`);
  }, [yo, enEntrada, codigo, router]);
  if (!yo && !enEntrada) return <Cargando />;
  return <>{children}</>;
}

export default function LayoutGrupo({ children }: { children: ReactNode }) {
  const { codigo } = useParams<{ codigo: string }>();
  return (
    <GrupoProvider
      codigo={codigo}
      cargando={<Cargando />}
      error={(msg, status) => (
        <main className="mx-auto max-w-md space-y-4 p-4 pt-12">
          <Alerta>{status === 404 ? "Este link no corresponde a ningún grupo. Pedile el link de nuevo a un amigo." : msg}</Alerta>
          <Link href="/" className="block text-center font-semibold text-orange-700">
            Ir al inicio
          </Link>
        </main>
      )}
    >
      <ExigirIdentidad>{children}</ExigirIdentidad>
    </GrupoProvider>
  );
}
