"use client";

export class ErrorApi extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch("/api" + path, {
      method: opts.method ?? "GET",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ErrorApi(0, "Sin conexión. Revisá internet y probá de nuevo.");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApi(r.status, (j as { error?: string }).error ?? "Algo salió mal");
  return j as T;
}

// ---------- identidad en el dispositivo ----------

const claveYo = (codigo: string) => `pena:yo:${codigo}`;

export function leerYo(codigo: string): string | null {
  try {
    return localStorage.getItem(claveYo(codigo));
  } catch {
    return null;
  }
}

export function guardarYo(codigo: string, id: string | null) {
  try {
    if (id) localStorage.setItem(claveYo(codigo), id);
    else localStorage.removeItem(claveYo(codigo));
  } catch {}
}

export interface GrupoReciente {
  codigo: string;
  nombre: string;
}

export function gruposRecientes(): GrupoReciente[] {
  try {
    return JSON.parse(localStorage.getItem("pena:grupos") || "[]");
  } catch {
    return [];
  }
}

export function recordarGrupo(g: GrupoReciente) {
  try {
    const lista = [g, ...gruposRecientes().filter((x) => x.codigo !== g.codigo)].slice(0, 10);
    localStorage.setItem("pena:grupos", JSON.stringify(lista));
  } catch {}
}

/** Saca el grupo de "Tus grupos" y borra la identidad guardada en este dispositivo. */
export function olvidarGrupo(codigo: string) {
  guardarYo(codigo, null);
  try {
    localStorage.setItem("pena:grupos", JSON.stringify(gruposRecientes().filter((g) => g.codigo !== codigo)));
  } catch {}
}

// ---------- utilidades ----------

export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Fallback para http (sin clipboard API) o navegadores viejos.
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    ta.remove();
    return ok;
  }
}

export function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
