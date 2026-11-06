// Tipos compartidos entre API y frontend (lo que viaja en JSON).

export interface Grupo {
  id: string;
  nombre: string;
  codigo_acceso: string;
}

export interface Miembro {
  id: string;
  nombre: string;
  alias_cbu: string | null;
  activo: boolean;
}

export type EstadoPena = "abierta" | "cerrada";

export interface Pena {
  id: string;
  nombre: string;
  fecha: string; // YYYY-MM-DD
  lugar: string | null;
  estado: EstadoPena;
  creado_por: string | null;
}

export interface Gasto {
  id: string;
  pagado_por: string;
  monto_centavos: number;
  descripcion: string;
  /** null = entre todos los asistentes */
  participantes: string[] | null;
  creado_por: string | null;
  creado_en: string;
  editado_en: string | null;
}

export interface Pago {
  id: string;
  de_miembro_id: string;
  a_miembro_id: string;
  monto_centavos: number;
  creado_en: string;
}

export interface PenaDetalle {
  pena: Pena;
  asistentes: string[];
  gastos: Gasto[];
  pagos: Pago[];
}

export interface PenaResumen extends Pena {
  total: number;
  cantidad_asistentes: number;
  asistentes: string[];
  /** saldo pendiente por miembro (positivo = le deben) */
  saldos: Record<string, number>;
  transferencias_pendientes: number;
}

export interface GrupoDetalle {
  grupo: Grupo;
  miembros: Miembro[];
}
