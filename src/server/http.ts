import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "./repo";

/**
 * Límite de intentos por IP, en memoria del proceso.
 * - General: 240 pedidos por minuto.
 * - Códigos de grupo inexistentes: 20 cada 15 minutos (frena a quien quiera adivinar links).
 * En serverless cada instancia tiene su propio contador; para esta escala alcanza.
 */
interface Ventana {
  n: number;
  hasta: number;
}
const g = globalThis as unknown as { __penaRate?: { general: Map<string, Ventana>; fallidos: Map<string, Ventana> } };
const rate = (g.__penaRate ??= { general: new Map(), fallidos: new Map() });

function contar(mapa: Map<string, Ventana>, ip: string, ms: number): number {
  const ahora = Date.now();
  let v = mapa.get(ip);
  if (!v || v.hasta < ahora) {
    v = { n: 0, hasta: ahora + ms };
    mapa.set(ip, v);
  }
  v.n++;
  if (mapa.size > 5000) for (const [k, x] of mapa) if (x.hasta < ahora) mapa.delete(k);
  return v.n;
}

function excedido(mapa: Map<string, Ventana>, ip: string, max: number): boolean {
  const v = mapa.get(ip);
  return !!v && v.hasta >= Date.now() && v.n >= max;
}

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

const MAX_FALLIDOS = 20;

export async function handle<T>(req: NextRequest, fn: (body: Record<string, unknown>) => Promise<T>, status = 200) {
  const ip = ipDe(req);
  if (contar(rate.general, ip, 60_000) > 240 || excedido(rate.fallidos, ip, MAX_FALLIDOS)) {
    return NextResponse.json({ error: "Demasiados intentos. Probá de nuevo en unos minutos." }, { status: 429 });
  }
  try {
    let body: Record<string, unknown> = {};
    if (req.method !== "GET" && req.method !== "DELETE") {
      try {
        const j = await req.json();
        if (j && typeof j === "object" && !Array.isArray(j)) body = j;
      } catch {
        return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
      }
    }
    const data = await fn(body);
    return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.intentoFallido || (e.status === 404 && e.message === "Grupo no encontrado")) {
        contar(rate.fallidos, ip, 15 * 60_000);
      }
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error(e);
    return NextResponse.json({ error: "Error inesperado. Probá de nuevo." }, { status: 500 });
  }
}

/** Next 15 pasa params como Promise; await también funciona si viene como objeto. */
export type Ctx<P> = { params: Promise<P> };
