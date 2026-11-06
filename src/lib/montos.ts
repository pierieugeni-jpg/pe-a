/** Formato y parseo de montos en pesos argentinos. Los montos internos son centavos enteros. */

export const MONTO_MAXIMO_CENTAVOS = 10_000_000 * 100;

function agrupar(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 1250050 → "$12.500,50"; 10000000 → "$100.000"; -1000000 → "−$10.000". */
export function formatARS(centavos: number, { signo = false }: { signo?: boolean } = {}): string {
  const neg = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const pesos = Math.floor(abs / 100);
  const cent = abs % 100;
  const cuerpo = "$" + agrupar(pesos) + (cent ? "," + String(cent).padStart(2, "0") : "");
  if (neg) return "−" + cuerpo;
  if (signo && abs > 0) return "+" + cuerpo;
  return cuerpo;
}

/**
 * Parsea lo que escribe el usuario. Acepta "12.500,50", "12500,5", "12500", "$ 12.500".
 * Sin coma, un punto seguido de 1 o 2 dígitos al final se toma como decimal ("12500.50").
 * Devuelve centavos o null si no es válido.
 */
export function parseMonto(texto: string): number | null {
  let s = texto.trim().replace(/^\$/, "").replace(/\s/g, "");
  if (!s) return null;
  let entero: string;
  let dec = "";
  if (s.includes(",")) {
    const partes = s.split(",");
    if (partes.length !== 2) return null;
    [entero, dec] = partes;
    if (!/^\d{0,2}$/.test(dec)) return null;
  } else {
    const m = s.match(/^(.*)\.(\d{1,2})$/);
    if (m && !m[1].includes(".")) {
      entero = m[1];
      dec = m[2];
    } else {
      entero = s;
    }
  }
  if (entero.includes(".")) {
    if (!/^\d{1,3}(\.\d{3})+$/.test(entero)) return null;
    entero = entero.replace(/\./g, "");
  }
  if (!/^\d*$/.test(entero) || (entero === "" && dec === "")) return null;
  const centavos = Number(entero || "0") * 100 + Number(dec.padEnd(2, "0") || "0");
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/** Centavos → texto editable ("12500,50" / "12500"). */
export function centavosATexto(centavos: number): string {
  const pesos = Math.floor(centavos / 100);
  const cent = centavos % 100;
  return agrupar(pesos) + (cent ? "," + String(cent).padStart(2, "0") : "");
}

export function validarMonto(centavos: number | null): string | null {
  if (centavos === null || !Number.isInteger(centavos)) return "Monto inválido";
  if (centavos <= 0) return "El monto tiene que ser mayor a 0";
  if (centavos > MONTO_MAXIMO_CENTAVOS) return "El monto máximo es $10.000.000";
  return null;
}

/** "2026-11-14" → "14/11" */
export function fechaCorta(fecha: string): string {
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}

/** "2026-11-14" → "sáb 14/11/2026" */
export function fechaLarga(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const dia = dias[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dia} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
