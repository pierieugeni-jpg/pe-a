import type { CuentasResultado } from "./cuentas";
import { fechaCorta, formatARS } from "./montos";

export interface MiembroResumen {
  id: string;
  nombre: string;
  alias_cbu: string | null;
}

/** Texto plano para WhatsApp: "Peña 14/11 — Total $100.000, $20.000 c/u. Lucía → Juan $20.000 (juan.mp)." */
export function resumenWhatsApp(
  pena: { nombre: string; fecha: string },
  cuentas: CuentasResultado,
  miembros: MiembroResumen[],
): string {
  const porId = new Map(miembros.map((m) => [m.id, m]));
  const nombre = (id: string) => porId.get(id)?.nombre ?? "?";
  const titulo = pena.nombre?.trim() || `Peña ${fechaCorta(pena.fecha)}`;
  const partes = [`${titulo} — Total ${formatARS(cuentas.total)}, ${formatARS(cuentas.costoPorPersona)} c/u.`];
  if (cuentas.transferencias.length === 0) {
    partes.push(cuentas.total > 0 ? "Todo saldado." : "Sin gastos.");
  }
  for (const t of cuentas.transferencias) {
    const alias = porId.get(t.a)?.alias_cbu;
    partes.push(`${nombre(t.de)} → ${nombre(t.a)} ${formatARS(t.monto)}${alias ? ` (${alias})` : ""}.`);
  }
  return partes.join(" ");
}
