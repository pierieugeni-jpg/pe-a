import { timingSafeEqual } from "node:crypto";
import { calcularCuentas, type CuentasResultado } from "@/lib/cuentas";
import { validarMonto } from "@/lib/montos";
import type {
  Concepto,
  Gasto,
  Grupo,
  GrupoDetalle,
  Miembro,
  Pago,
  Pena,
  PenaDetalle,
  PenaResumen,
} from "@/lib/tipos";
import { getDb, type Query } from "./db";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Suma al límite de intentos fallidos por IP (códigos inválidos). */
    public intentoFallido = false,
  ) {
    super(message);
  }
}

/**
 * Crear grupos requiere el código de CODIGO_CREACION (variable de entorno).
 * Sin la variable: en local se permite (desarrollo); en Vercel se bloquea, para no dejarlo abierto por error.
 */
function exigirCodigoCreacion(enviado: unknown) {
  const esperado = (process.env.CODIGO_CREACION ?? "").trim();
  if (!esperado) {
    if (process.env.VERCEL) {
      throw new ApiError(503, "La creación de grupos no está habilitada todavía. Avisale al administrador.");
    }
    return;
  }
  const a = Buffer.from(typeof enviado === "string" ? enviado.trim() : "");
  const b = Buffer.from(esperado);
  // Comparación en tiempo constante.
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) throw new ApiError(403, "El código para crear grupos no es correcto. Pedíselo al administrador.", true);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// ---------- helpers de validación ----------

function texto(v: unknown, campo: string, max: number, requerido = true): string | null {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
    if (requerido) throw new ApiError(400, `Falta ${campo}`);
    return null;
  }
  if (typeof v !== "string") throw new ApiError(400, `${campo} inválido`);
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length > max) throw new ApiError(400, `${campo}: máximo ${max} caracteres`);
  return s;
}

function uuid(v: unknown, campo = "id"): string {
  if (typeof v !== "string" || !UUID.test(v)) throw new ApiError(400, `${campo} inválido`);
  return v.toLowerCase();
}

function listaIds(v: unknown, campo: string): string[] {
  if (!Array.isArray(v)) throw new ApiError(400, `${campo} inválido`);
  return [...new Set(v.map((x) => uuid(x, campo)))];
}

function fecha(v: unknown): string {
  if (typeof v !== "string" || !FECHA.test(v) || Number.isNaN(Date.parse(v))) {
    throw new ApiError(400, "Fecha inválida");
  }
  return v;
}

function centavos(v: unknown): number {
  const n = typeof v === "number" ? v : NaN;
  const err = validarMonto(Number.isInteger(n) ? n : null);
  if (err) throw new ApiError(400, err);
  return n;
}

function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function esDuplicado(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23505";
}

function nuevoCodigo(largo = 12): string {
  const alfabeto = "abcdefghjkmnpqrstuvwxyz23456789"; // sin caracteres ambiguos
  const bytes = crypto.getRandomValues(new Uint8Array(largo * 2));
  let s = "";
  for (const b of bytes) {
    if (b >= 248) continue; // 248 = 8 * 31, evita sesgo
    s += alfabeto[b % alfabeto.length];
    if (s.length === largo) break;
  }
  return s.length === largo ? s : nuevoCodigo(largo);
}

// ---------- mapeo de filas ----------

const SEL_PENA = `id, nombre, to_char(fecha, 'YYYY-MM-DD') as fecha, lugar, estado, creado_por`;

function aPena(r: Record<string, unknown>): Pena {
  return {
    id: String(r.id),
    nombre: String(r.nombre),
    fecha: String(r.fecha),
    lugar: (r.lugar as string) ?? null,
    estado: r.estado as Pena["estado"],
    creado_por: (r.creado_por as string) ?? null,
  };
}

function aMiembro(r: Record<string, unknown>): Miembro {
  return {
    id: String(r.id),
    nombre: String(r.nombre),
    alias_cbu: (r.alias_cbu as string) ?? null,
    activo: Boolean(r.activo),
  };
}

// ---------- grupos y miembros ----------

export async function crearGrupo(body: Record<string, unknown>) {
  exigirCodigoCreacion(body.codigo_creacion);
  const nombre = texto(body.nombre, "el nombre del grupo", 60)!;
  const miembrosIn = Array.isArray(body.miembros) ? body.miembros : [];
  const miembros = miembrosIn.map((m: Record<string, unknown>) => ({
    nombre: texto(m?.nombre, "el nombre del miembro", 40)!,
    alias_cbu: texto(m?.alias_cbu, "alias/CBU", 60, false),
  }));
  const nombres = new Set(miembros.map((m) => m.nombre.toLowerCase()));
  if (nombres.size !== miembros.length) throw new ApiError(400, "Hay nombres de miembros repetidos");

  const db = await getDb();
  const codigo = nuevoCodigo();
  return db.tx(async (q) => {
    const [g] = await q(`insert into grupos (nombre, codigo_acceso) values ($1, $2) returning id`, [nombre, codigo]);
    const creados: Miembro[] = [];
    for (const m of miembros) {
      const [r] = await q(
        `insert into miembros (grupo_id, nombre, alias_cbu) values ($1, $2, $3) returning id, nombre, alias_cbu, activo`,
        [g.id, m.nombre, m.alias_cbu],
      );
      creados.push(aMiembro(r));
    }
    return { codigo, link: `/g/${codigo}`, miembros: creados };
  });
}

async function grupoPorCodigo(q: Query, codigo: string): Promise<Grupo> {
  const [g] = await q(`select id, nombre, codigo_acceso from grupos where codigo_acceso = $1`, [codigo]);
  if (!g) throw new ApiError(404, "Grupo no encontrado");
  return { id: String(g.id), nombre: String(g.nombre), codigo_acceso: String(g.codigo_acceso) };
}

async function miembrosDe(q: Query, grupoId: string): Promise<Miembro[]> {
  const rows = await q(
    `select id, nombre, alias_cbu, activo from miembros where grupo_id = $1 order by lower(nombre)`,
    [grupoId],
  );
  return rows.map(aMiembro);
}

export async function getGrupo(codigo: string): Promise<GrupoDetalle> {
  const db = await getDb();
  const grupo = await grupoPorCodigo(db.query, codigo);
  return { grupo, miembros: await miembrosDe(db.query, grupo.id) };
}

/**
 * Elimina el grupo con todo lo que tiene (miembros, peñas, gastos, pagos).
 * Requiere el código de administrador (CODIGO_CREACION).
 */
export async function borrarGrupo(codigo: string, body: Record<string, unknown>) {
  exigirCodigoCreacion(body.codigo_creacion);
  const db = await getDb();
  return db.tx(async (q) => {
    const grupo = await grupoPorCodigo(q, codigo);
    // En orden: primero las peñas (cascada a asistencias, gastos, participantes y pagos, que referencian
    // a los miembros) y después el grupo (cascada a miembros). Un solo delete del grupo falla por las FK.
    await q(`delete from penas where grupo_id = $1`, [grupo.id]);
    await q(`delete from grupos where id = $1`, [grupo.id]);
    return { ok: true };
  });
}

export async function crearMiembro(codigo: string, body: Record<string, unknown>): Promise<Miembro> {
  const nombre = texto(body.nombre, "el nombre", 40)!;
  const alias = texto(body.alias_cbu, "alias/CBU", 60, false);
  const db = await getDb();
  const grupo = await grupoPorCodigo(db.query, codigo);
  try {
    const [r] = await db.query(
      `insert into miembros (grupo_id, nombre, alias_cbu) values ($1, $2, $3) returning id, nombre, alias_cbu, activo`,
      [grupo.id, nombre, alias],
    );
    return aMiembro(r);
  } catch (e) {
    if (esDuplicado(e)) throw new ApiError(409, `Ya hay un miembro que se llama ${nombre}`);
    throw e;
  }
}

export async function editarMiembro(codigo: string, id: string, body: Record<string, unknown>): Promise<Miembro> {
  id = uuid(id);
  const db = await getDb();
  const grupo = await grupoPorCodigo(db.query, codigo);
  const sets: string[] = [];
  const params: unknown[] = [id, grupo.id];
  if ("nombre" in body) {
    params.push(texto(body.nombre, "el nombre", 40));
    sets.push(`nombre = $${params.length}`);
  }
  if ("alias_cbu" in body) {
    // Cada uno carga su propio alias (el navegador manda quién es; no hay login, alcanza para evitar errores).
    if (body.editado_por !== id) throw new ApiError(403, "Cada uno puede cambiar solo su propio alias");
    params.push(texto(body.alias_cbu, "alias/CBU", 60, false));
    sets.push(`alias_cbu = $${params.length}`);
  }
  if ("activo" in body) {
    if (typeof body.activo !== "boolean") throw new ApiError(400, "activo inválido");
    params.push(body.activo);
    sets.push(`activo = $${params.length}`);
  }
  if (sets.length === 0) throw new ApiError(400, "Nada para cambiar");
  try {
    const [r] = await db.query(
      `update miembros set ${sets.join(", ")} where id = $1 and grupo_id = $2 returning id, nombre, alias_cbu, activo`,
      params,
    );
    if (!r) throw new ApiError(404, "Miembro no encontrado");
    return aMiembro(r);
  } catch (e) {
    if (esDuplicado(e)) throw new ApiError(409, "Ya hay un miembro con ese nombre");
    throw e;
  }
}

// ---------- peñas ----------

async function penaDelGrupo(q: Query, grupoId: string, penaId: string, forUpdate = false): Promise<Pena> {
  const [r] = await q(
    `select ${SEL_PENA} from penas where id = $1 and grupo_id = $2${forUpdate ? " for update" : ""}`,
    [uuid(penaId), grupoId],
  );
  if (!r) throw new ApiError(404, "Peña no encontrada");
  return aPena(r);
}

function exigirAbierta(p: Pena) {
  if (p.estado === "cerrada") throw new ApiError(409, "La peña está cerrada. Reabrila para hacer cambios.");
}

async function validarMiembrosDelGrupo(q: Query, grupoId: string, ids: string[]) {
  if (ids.length === 0) return;
  const rows = await q(`select id from miembros where grupo_id = $1`, [grupoId]);
  const validos = new Set(rows.map((r) => String(r.id)));
  for (const id of ids) if (!validos.has(id)) throw new ApiError(400, "Hay un miembro que no es del grupo");
}

async function detalle(q: Query, pena: Pena): Promise<PenaDetalle> {
  const asis = await q(`select miembro_id from asistencias where pena_id = $1`, [pena.id]);
  const gastos = await q(
    `select id, pagado_por, monto_centavos, descripcion, conceptos, creado_por, creado_en, editado_en
       from gastos where pena_id = $1 order by creado_en desc, id`,
    [pena.id],
  );
  const parts = await q(
    `select gp.gasto_id, gp.miembro_id from gasto_participantes gp join gastos g on g.id = gp.gasto_id where g.pena_id = $1`,
    [pena.id],
  );
  const pagos = await q(
    `select id, de_miembro_id, a_miembro_id, monto_centavos, creado_en from pagos where pena_id = $1 order by creado_en`,
    [pena.id],
  );
  const porGasto = new Map<string, string[]>();
  for (const p of parts) {
    const k = String(p.gasto_id);
    porGasto.set(k, [...(porGasto.get(k) ?? []), String(p.miembro_id)]);
  }
  return {
    pena,
    asistentes: asis.map((a) => String(a.miembro_id)),
    gastos: gastos.map(
      (g): Gasto => ({
        id: String(g.id),
        pagado_por: String(g.pagado_por),
        monto_centavos: Number(g.monto_centavos),
        descripcion: String(g.descripcion),
        conceptos: leerConceptos(g.conceptos),
        participantes: porGasto.get(String(g.id)) ?? null,
        creado_por: (g.creado_por as string) ?? null,
        creado_en: iso(g.creado_en),
        editado_en: g.editado_en ? iso(g.editado_en) : null,
      }),
    ),
    pagos: pagos.map(
      (p): Pago => ({
        id: String(p.id),
        de_miembro_id: String(p.de_miembro_id),
        a_miembro_id: String(p.a_miembro_id),
        monto_centavos: Number(p.monto_centavos),
        creado_en: iso(p.creado_en),
      }),
    ),
  };
}

function cuentasDe(d: PenaDetalle, miembros: Miembro[]): CuentasResultado {
  const porId = new Map(miembros.map((m) => [m.id, m]));
  return calcularCuentas({
    asistentes: d.asistentes.map((id) => ({ id, nombre: porId.get(id)?.nombre ?? "?" })),
    gastos: d.gastos,
    pagos: d.pagos,
  });
}

export async function listarPenas(codigo: string): Promise<PenaResumen[]> {
  const db = await getDb();
  const grupo = await grupoPorCodigo(db.query, codigo);
  const miembros = await miembrosDe(db.query, grupo.id);
  const penas = (await db.query(`select ${SEL_PENA} from penas where grupo_id = $1 order by fecha desc, creado_en desc`, [grupo.id])).map(aPena);
  // Escala chica (≤ 5 grupos, ≤ 50 gastos por peña): alcanza con calcular cada peña.
  const res: PenaResumen[] = [];
  for (const p of penas) {
    const d = await detalle(db.query, p);
    const c = cuentasDe(d, miembros);
    res.push({
      ...p,
      total: c.total,
      cantidad_asistentes: d.asistentes.length,
      asistentes: d.asistentes,
      saldos: Object.fromEntries(c.personas.map((x) => [x.id, x.pendiente])),
      transferencias_pendientes: c.transferencias.length,
    });
  }
  return res;
}

export async function crearPena(codigo: string, body: Record<string, unknown>): Promise<Pena> {
  const f = fecha(body.fecha);
  const lugar = texto(body.lugar, "el lugar", 60, false);
  const [, m, d] = f.split("-");
  const nombre = texto(body.nombre, "el nombre", 60, false) ?? (lugar ? `Peña en ${lugar}` : `Peña ${d}/${m}`);
  const asistentes = listaIds(body.asistentes ?? [], "asistentes");
  if (asistentes.length === 0) throw new ApiError(400, "Marcá al menos un asistente");
  const creadoPor = body.creado_por ? uuid(body.creado_por, "creado_por") : null;

  const db = await getDb();
  return db.tx(async (q) => {
    const grupo = await grupoPorCodigo(q, codigo);
    await validarMiembrosDelGrupo(q, grupo.id, creadoPor ? [...asistentes, creadoPor] : asistentes);
    const [r] = await q(
      `insert into penas (grupo_id, nombre, fecha, lugar, creado_por) values ($1, $2, $3, $4, $5) returning ${SEL_PENA}`,
      [grupo.id, nombre, f, lugar, creadoPor],
    );
    for (const id of asistentes) {
      await q(`insert into asistencias (pena_id, miembro_id) values ($1, $2)`, [r.id, id]);
    }
    return aPena(r);
  });
}

export async function getPena(codigo: string, penaId: string): Promise<PenaDetalle> {
  const db = await getDb();
  const grupo = await grupoPorCodigo(db.query, codigo);
  return detalle(db.query, await penaDelGrupo(db.query, grupo.id, penaId));
}

export async function getCuentas(codigo: string, penaId: string) {
  const db = await getDb();
  const grupo = await grupoPorCodigo(db.query, codigo);
  const d = await detalle(db.query, await penaDelGrupo(db.query, grupo.id, penaId));
  return cuentasDe(d, await miembrosDe(db.query, grupo.id));
}

export async function editarPena(codigo: string, penaId: string, body: Record<string, unknown>): Promise<PenaDetalle> {
  const db = await getDb();
  return db.tx(async (q) => {
    const grupo = await grupoPorCodigo(q, codigo);
    const pena = await penaDelGrupo(q, grupo.id, penaId, true);

    // Cambio de estado (cerrar / reabrir)
    if ("estado" in body) {
      if (body.estado !== "abierta" && body.estado !== "cerrada") throw new ApiError(400, "Estado inválido");
      if (body.estado === "cerrada" && pena.estado === "abierta") {
        const c = cuentasDe(await detalle(q, pena), await miembrosDe(q, grupo.id));
        if (!c.saldado) {
          throw new ApiError(409, "Todavía hay transferencias sin pagar. Marcalas como pagadas antes de cerrar.");
        }
      }
      await q(`update penas set estado = $2 where id = $1`, [pena.id, body.estado]);
      pena.estado = body.estado;
    }

    const cambiaDatos = "nombre" in body || "fecha" in body || "lugar" in body || "asistentes" in body;
    if (cambiaDatos) exigirAbierta(pena);

    if ("nombre" in body || "fecha" in body || "lugar" in body) {
      const f = "fecha" in body ? fecha(body.fecha) : pena.fecha;
      const lugar = "lugar" in body ? texto(body.lugar, "el lugar", 60, false) : pena.lugar;
      const nombre = "nombre" in body ? texto(body.nombre, "el nombre", 60)! : pena.nombre;
      await q(`update penas set nombre = $2, fecha = $3, lugar = $4 where id = $1`, [pena.id, nombre, f, lugar]);
    }

    if ("asistentes" in body) {
      const nuevos = listaIds(body.asistentes, "asistentes");
      if (nuevos.length === 0) throw new ApiError(400, "Tiene que haber al menos un asistente");
      await validarMiembrosDelGrupo(q, grupo.id, nuevos);
      const d = await detalle(q, pena);
      const miembros = await miembrosDe(q, grupo.id);
      const nombre = (id: string) => miembros.find((m) => m.id === id)?.nombre ?? "?";
      const salen = d.asistentes.filter((id) => !nuevos.includes(id));

      for (const id of salen) {
        const pagados = d.gastos.filter((g) => g.pagado_por === id);
        if (pagados.length > 0) {
          throw new ApiError(
            409,
            `${nombre(id)} pagó ${pagados.map((g) => `"${g.descripcion}"`).join(", ")}. Reasigná o borrá ese gasto antes de sacarlo.`,
          );
        }
        if (d.pagos.some((p) => p.de_miembro_id === id || p.a_miembro_id === id)) {
          throw new ApiError(409, `${nombre(id)} tiene transferencias marcadas como pagadas. Desmarcalas antes de sacarlo.`);
        }
        const unicoEn = d.gastos.find((g) => g.participantes?.length === 1 && g.participantes[0] === id);
        if (unicoEn) {
          throw new ApiError(409, `"${unicoEn.descripcion}" se divide solo entre ${nombre(id)}. Editá ese gasto antes de sacarlo.`);
        }
      }
      for (const id of salen) {
        await q(
          `delete from gasto_participantes where miembro_id = $1 and gasto_id in (select id from gastos where pena_id = $2)`,
          [id, pena.id],
        );
        await q(`delete from asistencias where pena_id = $1 and miembro_id = $2`, [pena.id, id]);
      }
      for (const id of nuevos.filter((x) => !d.asistentes.includes(x))) {
        await q(`insert into asistencias (pena_id, miembro_id) values ($1, $2)`, [pena.id, id]);
      }
    }

    return detalle(q, await penaDelGrupo(q, grupo.id, pena.id));
  });
}

/** Borra una peña cerrada con sus asistencias, gastos y pagos (on delete cascade). */
export async function borrarPena(codigo: string, penaId: string) {
  const db = await getDb();
  return db.tx(async (q) => {
    const grupo = await grupoPorCodigo(q, codigo);
    const pena = await penaDelGrupo(q, grupo.id, penaId, true);
    if (pena.estado !== "cerrada") {
      throw new ApiError(409, "Solo se pueden eliminar peñas cerradas. Cerrala primero.");
    }
    await q(`delete from penas where id = $1`, [pena.id]);
    return { ok: true };
  });
}

// ---------- gastos ----------

interface GastoValidado {
  pagado_por: string;
  monto_centavos: number;
  descripcion: string;
  conceptos: Concepto[] | null;
  participantes: string[] | null;
}

function leerConceptos(v: unknown): Concepto[] | null {
  const arr = typeof v === "string" ? JSON.parse(v) : v;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr.map((c) => ({ descripcion: String(c.descripcion), monto_centavos: Number(c.monto_centavos) }));
}

const MAX_CONCEPTOS = 30;

/** Con 2 o más conceptos el total es la suma; con 1 (o ninguno) es un gasto común. */
function validarConceptos(v: unknown): Concepto[] | null {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) throw new ApiError(400, "Conceptos inválidos");
  if (v.length > MAX_CONCEPTOS) throw new ApiError(400, `Máximo ${MAX_CONCEPTOS} conceptos por gasto`);
  const lista = v.map((c: Record<string, unknown>, i) => ({
    descripcion: texto(c?.descripcion, `la descripción del concepto ${i + 1}`, 40)!,
    monto_centavos: centavos(c?.monto_centavos),
  }));
  return lista.length >= 2 ? lista : null;
}

function resumirConceptos(c: Concepto[]): string {
  const s = c.map((x) => x.descripcion).join(", ");
  return s.length <= 60 ? s : s.slice(0, 59).trimEnd() + "…";
}

function validarGasto(body: Record<string, unknown>, asistentes: string[]): GastoValidado {
  const conceptos = validarConceptos(body.conceptos);
  const monto = conceptos ? centavos(conceptos.reduce((s, c) => s + c.monto_centavos, 0)) : centavos(body.monto_centavos);
  const descripcion = conceptos
    ? (texto(body.descripcion, "la descripción", 60, false) ?? resumirConceptos(conceptos))
    : texto(body.descripcion, "la descripción", 60)!;
  const pagadoPor = uuid(body.pagado_por, "quién pagó");
  if (!asistentes.includes(pagadoPor)) throw new ApiError(400, "Quien pagó tiene que ser asistente de la peña");
  let participantes: string[] | null = null;
  if (body.participantes !== null && body.participantes !== undefined) {
    participantes = listaIds(body.participantes, "participantes");
    if (participantes.length === 0) throw new ApiError(400, "El gasto se tiene que dividir entre al menos 1 persona");
    if (participantes.some((id) => !asistentes.includes(id))) {
      throw new ApiError(400, "Todos los participantes tienen que ser asistentes");
    }
    // Si participan todos, se guarda como "todos" para que incluya a los que se sumen después.
    if (asistentes.every((id) => participantes!.includes(id))) participantes = null;
  }
  return { pagado_por: pagadoPor, monto_centavos: monto, descripcion, conceptos, participantes };
}

async function guardarParticipantes(q: Query, gastoId: string, participantes: string[] | null) {
  await q(`delete from gasto_participantes where gasto_id = $1`, [gastoId]);
  for (const id of participantes ?? []) {
    await q(`insert into gasto_participantes (gasto_id, miembro_id) values ($1, $2)`, [gastoId, id]);
  }
}

export async function crearGasto(codigo: string, penaId: string, body: Record<string, unknown>) {
  const db = await getDb();
  return db.tx(async (q) => {
    const grupo = await grupoPorCodigo(q, codigo);
    const pena = await penaDelGrupo(q, grupo.id, penaId, true);
    exigirAbierta(pena);
    const asis = (await q(`select miembro_id from asistencias where pena_id = $1`, [pena.id])).map((r) => String(r.miembro_id));
    const g = validarGasto(body, asis);
    const creadoPor = body.creado_por ? uuid(body.creado_por, "creado_por") : null;
    if (creadoPor) await validarMiembrosDelGrupo(q, grupo.id, [creadoPor]);
    const [r] = await q(
      `insert into gastos (pena_id, pagado_por, monto_centavos, descripcion, conceptos, creado_por)
       values ($1, $2, $3, $4, $5::jsonb, $6) returning id`,
      [pena.id, g.pagado_por, g.monto_centavos, g.descripcion, g.conceptos ? JSON.stringify(g.conceptos) : null, creadoPor],
    );
    await guardarParticipantes(q, String(r.id), g.participantes);
    return { id: String(r.id) };
  });
}

async function gastoDelGrupo(q: Query, grupoId: string, gastoId: string) {
  const [r] = await q(
    `select g.id, g.pena_id from gastos g join penas p on p.id = g.pena_id where g.id = $1 and p.grupo_id = $2`,
    [uuid(gastoId), grupoId],
  );
  if (!r) throw new ApiError(404, "Gasto no encontrado");
  return { id: String(r.id), pena_id: String(r.pena_id) };
}

export async function editarGasto(codigo: string, gastoId: string, body: Record<string, unknown>) {
  const db = await getDb();
  return db.tx(async (q) => {
    const grupo = await grupoPorCodigo(q, codigo);
    const gasto = await gastoDelGrupo(q, grupo.id, gastoId);
    const pena = await penaDelGrupo(q, grupo.id, gasto.pena_id, true);
    exigirAbierta(pena);
    const asis = (await q(`select miembro_id from asistencias where pena_id = $1`, [pena.id])).map((r) => String(r.miembro_id));
    const g = validarGasto(body, asis);
    await q(
      `update gastos set pagado_por = $2, monto_centavos = $3, descripcion = $4, conceptos = $5::jsonb, editado_en = now()
        where id = $1`,
      [gasto.id, g.pagado_por, g.monto_centavos, g.descripcion, g.conceptos ? JSON.stringify(g.conceptos) : null],
    );
    await guardarParticipantes(q, gasto.id, g.participantes);
    return { id: gasto.id };
  });
}

export async function borrarGasto(codigo: string, gastoId: string) {
  const db = await getDb();
  return db.tx(async (q) => {
    const grupo = await grupoPorCodigo(q, codigo);
    const gasto = await gastoDelGrupo(q, grupo.id, gastoId);
    exigirAbierta(await penaDelGrupo(q, grupo.id, gasto.pena_id, true));
    await q(`delete from gastos where id = $1`, [gasto.id]);
    return { ok: true };
  });
}

// ---------- pagos ----------

export async function crearPago(codigo: string, penaId: string, body: Record<string, unknown>) {
  const de = uuid(body.de_miembro_id, "de");
  const a = uuid(body.a_miembro_id, "a");
  const monto = centavos(body.monto_centavos);
  const db = await getDb();
  return db.tx(async (q) => {
    const grupo = await grupoPorCodigo(q, codigo);
    const pena = await penaDelGrupo(q, grupo.id, penaId, true);
    exigirAbierta(pena);
    // Solo se puede marcar una transferencia que la app esté sugiriendo ahora:
    // evita pagos duplicados si dos personas marcan la misma al mismo tiempo.
    const c = cuentasDe(await detalle(q, pena), await miembrosDe(q, grupo.id));
    if (!c.transferencias.some((t) => t.de === de && t.a === a && t.monto === monto)) {
      throw new ApiError(409, "Las cuentas cambiaron mientras tanto. Revisá las transferencias actualizadas.");
    }
    const [r] = await q(
      `insert into pagos (pena_id, de_miembro_id, a_miembro_id, monto_centavos) values ($1, $2, $3, $4) returning id`,
      [pena.id, de, a, monto],
    );
    return { id: String(r.id) };
  });
}

export async function borrarPago(codigo: string, penaId: string, pagoId: string) {
  const db = await getDb();
  return db.tx(async (q) => {
    const grupo = await grupoPorCodigo(q, codigo);
    const pena = await penaDelGrupo(q, grupo.id, penaId, true);
    exigirAbierta(pena);
    const r = await q(`delete from pagos where id = $1 and pena_id = $2 returning id`, [uuid(pagoId), pena.id]);
    if (r.length === 0) throw new ApiError(404, "Pago no encontrado");
    return { ok: true };
  });
}
