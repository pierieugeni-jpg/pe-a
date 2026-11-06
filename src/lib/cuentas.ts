/**
 * Cálculo de cuentas de una peña. Función pura: se usa en el servidor y en el navegador.
 * Todos los montos son centavos enteros.
 */

export interface PersonaInput {
  id: string;
  nombre: string;
}

export interface GastoInput {
  id: string;
  monto_centavos: number;
  pagado_por: string;
  /** Entre quiénes se divide. null o [] = entre todos los asistentes. */
  participantes: string[] | null;
}

export interface PagoInput {
  de_miembro_id: string;
  a_miembro_id: string;
  monto_centavos: number;
}

export interface CuentasInput {
  asistentes: PersonaInput[];
  gastos: GastoInput[];
  pagos: PagoInput[];
}

export interface SaldoPersona {
  id: string;
  nombre: string;
  /** Lo que pagó en gastos. */
  pagado: number;
  /** Suma de sus partes en los gastos. */
  leToca: number;
  /** pagado − leToca (sin contar transferencias marcadas). */
  saldo: number;
  /** Transferencias marcadas como pagadas que hizo / recibió. */
  transferido: number;
  recibido: number;
  /** Saldo que falta saldar: saldo + transferido − recibido. */
  pendiente: number;
}

export interface Transferencia {
  de: string;
  a: string;
  monto: number;
}

export interface CuentasResultado {
  total: number;
  cantidadAsistentes: number;
  /** total / asistentes, redondeado al centavo (solo informativo). */
  costoPorPersona: number;
  personas: SaldoPersona[];
  transferencias: Transferencia[];
  /** true si no queda nada por transferir. */
  saldado: boolean;
}

const collator = new Intl.Collator("es", { sensitivity: "base" });

function compararPersonas(a: PersonaInput, b: PersonaInput): number {
  return collator.compare(a.nombre, b.nombre) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Divide un monto en partes iguales entre los participantes.
 * Los centavos que sobran van de a 1 a los primeros en orden alfabético.
 */
export function dividirMonto(monto: number, participantes: PersonaInput[]): Map<string, number> {
  const res = new Map<string, number>();
  const n = participantes.length;
  if (n === 0) return res;
  const ordenados = [...participantes].sort(compararPersonas);
  const base = Math.floor(monto / n);
  const resto = monto - base * n;
  ordenados.forEach((p, i) => res.set(p.id, base + (i < resto ? 1 : 0)));
  return res;
}

export function calcularCuentas({ asistentes, gastos, pagos }: CuentasInput): CuentasResultado {
  const personas = new Map<string, SaldoPersona>();
  const nombres = new Map<string, PersonaInput>();

  const asegurar = (id: string): SaldoPersona => {
    let p = personas.get(id);
    if (!p) {
      const nombre = nombres.get(id)?.nombre ?? "?";
      p = { id, nombre, pagado: 0, leToca: 0, saldo: 0, transferido: 0, recibido: 0, pendiente: 0 };
      personas.set(id, p);
      if (!nombres.has(id)) nombres.set(id, { id, nombre });
    }
    return p;
  };

  for (const a of asistentes) nombres.set(a.id, a);
  for (const a of asistentes) asegurar(a.id);

  let total = 0;
  for (const g of gastos) {
    total += g.monto_centavos;
    asegurar(g.pagado_por).pagado += g.monto_centavos;
    const ids = g.participantes && g.participantes.length > 0 ? g.participantes : asistentes.map((a) => a.id);
    const partes = dividirMonto(
      g.monto_centavos,
      ids.map((id) => nombres.get(id) ?? { id, nombre: "?" }),
    );
    for (const [id, parte] of partes) asegurar(id).leToca += parte;
  }

  for (const p of pagos) {
    asegurar(p.de_miembro_id).transferido += p.monto_centavos;
    asegurar(p.a_miembro_id).recibido += p.monto_centavos;
  }

  const lista = [...personas.values()].sort(compararPersonas);
  for (const p of lista) {
    p.saldo = p.pagado - p.leToca;
    p.pendiente = p.saldo + p.transferido - p.recibido;
  }

  const transferencias = sugerirTransferencias(lista.map((p) => ({ id: p.id, nombre: p.nombre, saldo: p.pendiente })));
  const cantidadAsistentes = asistentes.length;

  return {
    total,
    cantidadAsistentes,
    costoPorPersona: cantidadAsistentes > 0 ? Math.round(total / cantidadAsistentes) : 0,
    personas: lista,
    transferencias,
    saldado: transferencias.length === 0,
  };
}

/**
 * Algoritmo greedy: el mayor deudor le transfiere al mayor acreedor el menor de los dos montos,
 * se descuenta, se saca al que quedó en 0 y se repite. Máximo (n − 1) transferencias.
 * Empates: orden alfabético, para que el resultado sea siempre el mismo.
 */
export function sugerirTransferencias(saldos: { id: string; nombre: string; saldo: number }[]): Transferencia[] {
  const deudores = saldos.filter((s) => s.saldo < 0).map((s) => ({ ...s, resto: -s.saldo }));
  const acreedores = saldos.filter((s) => s.saldo > 0).map((s) => ({ ...s, resto: s.saldo }));
  const orden = (a: { resto: number } & PersonaInput, b: { resto: number } & PersonaInput) =>
    b.resto - a.resto || compararPersonas(a, b);

  const res: Transferencia[] = [];
  while (deudores.length > 0 && acreedores.length > 0) {
    deudores.sort(orden);
    acreedores.sort(orden);
    const d = deudores[0];
    const c = acreedores[0];
    const monto = Math.min(d.resto, c.resto);
    res.push({ de: d.id, a: c.id, monto });
    d.resto -= monto;
    c.resto -= monto;
    if (d.resto === 0) deudores.shift();
    if (c.resto === 0) acreedores.shift();
  }
  return res;
}
