import { SCHEMA_SQL } from "./schema";

/**
 * Adaptador mínimo de base de datos.
 * - Con DATABASE_URL: Postgres real (Supabase, Neon, etc.) vía `postgres`.
 * - Sin DATABASE_URL: PGlite (Postgres embebido en WASM) guardado en ./.data, para desarrollo.
 * Ambos hablan el mismo SQL con parámetros $1, $2...
 */

export type Row = Record<string, unknown>;
export type Query = <T extends Row = Row>(text: string, params?: unknown[]) => Promise<T[]>;

export interface Db {
  query: Query;
  tx<T>(fn: (q: Query) => Promise<T>): Promise<T>;
}

async function crearDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    // prepare:false para funcionar con el pooler en modo transacción de Supabase.
    const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20 });
    const q =
      (s: { unsafe: (t: string, p?: never[]) => Promise<unknown> }): Query =>
      async (text, params = []) =>
        (await s.unsafe(text, params as never[])) as never;
    const db: Db = {
      query: q(sql),
      tx: (fn) => sql.begin((t) => fn(q(t as never))) as never,
    };
    await sql.unsafe(SCHEMA_SQL);
    return db;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(process.env.PGLITE_DIR || "./.data/pglite");
  await pg.exec(SCHEMA_SQL);
  type Conn = { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> };
  const q =
    (c: Conn): Query =>
    async (text, params = []) =>
      (await c.query(text, params)).rows as never;
  return {
    query: q(pg),
    tx: (fn) => pg.transaction((t) => fn(q(t))),
  };
}

const g = globalThis as unknown as { __penaDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__penaDb) {
    g.__penaDb = crearDb().catch((e) => {
      g.__penaDb = undefined;
      throw e;
    });
  }
  return g.__penaDb;
}
