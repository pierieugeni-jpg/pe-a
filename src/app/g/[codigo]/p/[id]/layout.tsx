"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useGrupo } from "@/client/grupo";
import { PenaProvider, usePena } from "@/client/pena";
import { Encabezado, EstadoBadge } from "@/client/ui";
import { fechaLarga } from "@/lib/montos";

function Marco({ children }: { children: ReactNode }) {
  const { codigo } = useGrupo();
  const { detalle } = usePena();
  const path = usePathname();
  const base = `/g/${codigo}/p/${detalle.pena.id}`;
  const enTabs = path === base || path === `${base}/cuentas`;
  if (!enTabs) return <>{children}</>;
  const tab = (href: string, texto: string) => {
    const activo = path === href;
    return (
      <Link
        href={href}
        replace
        className={`flex min-h-11 flex-1 items-center justify-center border-b-2 text-sm font-semibold ${
          activo ? "border-orange-600 text-orange-700" : "border-transparent text-stone-500"
        }`}
      >
        {texto}
      </Link>
    );
  };
  const p = detalle.pena;
  return (
    <>
      <Encabezado
        titulo={p.nombre}
        sub={`${fechaLarga(p.fecha)}${p.lugar ? ` · ${p.lugar}` : ""}`}
        volver={`/g/${codigo}`}
        derecha={<EstadoBadge estado={p.estado} />}
      />
      <nav className="sticky top-14 z-10 border-b border-stone-200 bg-stone-50">
        <div className="mx-auto flex max-w-md px-4">
          {tab(base, "Gastos")}
          {tab(`${base}/cuentas`, "Cuentas")}
        </div>
      </nav>
      {children}
    </>
  );
}

export default function LayoutPena({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  return (
    <PenaProvider id={id}>
      <Marco>{children}</Marco>
    </PenaProvider>
  );
}
