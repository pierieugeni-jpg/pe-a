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

type SaldoIn = { id: string; nombre: string; saldo: number };

/** Hasta cuántas personas con saldo se busca el mínimo exacto (2^n combinaciones). Más que eso: greedy. */
const MAX_EXACTO = 16;

/**
 * Transferencias sugeridas con la menor cantidad posible.
 *
 * Un grupo de k personas cuyos saldos suman 0 se salda con k − 1 transferencias, así que el mínimo
 * total es n − (cantidad máxima de grupos que suman 0 en los que se puede partir a la gente).
 * Se busca esa partición con programación dinámica sobre subconjuntos y cada grupo se salda con
 * el greedy. Ej.: +10, +5, −10, −5 → 2 transferencias (el greedy solo, en otros casos, hace más).
 *
 * Orden del resultado: monto de mayor a menor, después alfabético. Siempre da lo mismo para los mismos datos.
 */
export function sugerirTransferencias(saldos: SaldoIn[]): Transferencia[] {
  const conSaldo = saldos.filter((s) => s.saldo !== 0).sort(compararPersonas);
  const n = conSaldo.length;
  if (n === 0) return [];

  let grupos: SaldoIn[][];
  if (n > MAX_EXACTO) {
    grupos = [conSaldo];
  } else {
    const total = 1 << n;
    const suma = new Float64Array(total);
    const mejor = new Int8Array(total);
    const ultimo = new Int8Array(total);
    for (let mask = 1; mask < total; mask++) {
      const bajo = 31 - Math.clz32(mask & -mask);
      suma[mask] = suma[mask & (mask - 1)] + conSaldo[bajo].saldo;
      let b = -1;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i) && mejor[mask ^ (1 << i)] > b) {
          b = mejor[mask ^ (1 << i)];
          ultimo[mask] = i;
        }
      }
      mejor[mask] = b + (suma[mask] === 0 ? 1 : 0);
    }
    // Reconstruir: sacando de a una persona, cada vez que lo que queda suma 0 se cierra un grupo.
    grupos = [];
    let actual: SaldoIn[] = [];
    for (let mask = total - 1; mask > 0; ) {
      const i = ultimo[mask];
      actual.push(conSaldo[i]);
      mask ^= 1 << i;
      if (suma[mask] === 0) {
        grupos.push(actual);
        actual = [];
      }
    }
  }

  const res = grupos.flatMap(greedy);
  const nombre = new Map(conSaldo.map((s) => [s.id, s]));
  return res.sort(
    (x, y) =>
      y.monto - x.monto || compararPersonas(nombre.get(x.de)!, nombre.get(y.de)!) || compararPersonas(nombre.get(x.a)!, nombre.get(y.a)!),
  );
}

/**
 * Greedy: el mayor deudor le transfiere al mayor acreedor el menor de los dos montos,
 * se descuenta, se saca al que quedó en 0 y se repite. Máximo (n − 1) transferencias.
 * Empates: orden alfabético, para que el resultado sea siempre el mismo.
 */
function greedy(saldos: SaldoIn[]): Transferencia[] {
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
