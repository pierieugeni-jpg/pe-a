-- Esquema de la app de la peña (Postgres). Idempotente.
-- La app lo corre sola al arrancar; también se puede pegar en el SQL Editor de Supabase.
-- Copia de src/server/schema.ts: si cambiás uno, cambiá el otro.

create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 60),
  codigo_acceso text not null unique check (char_length(codigo_acceso) >= 10),
  creado_en timestamptz not null default now()
);

create table if not exists miembros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 40),
  alias_cbu text check (alias_cbu is null or char_length(alias_cbu) <= 60),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create unique index if not exists miembros_nombre_unico on miembros (grupo_id, lower(nombre));

create table if not exists penas (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 60),
  fecha date not null,
  lugar text check (lugar is null or char_length(lugar) <= 60),
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  creado_por uuid references miembros(id),
  creado_en timestamptz not null default now()
);
create index if not exists penas_grupo on penas (grupo_id, fecha desc);

create table if not exists asistencias (
  pena_id uuid not null references penas(id) on delete cascade,
  miembro_id uuid not null references miembros(id),
  primary key (pena_id, miembro_id)
);

create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  pena_id uuid not null references penas(id) on delete cascade,
  pagado_por uuid not null references miembros(id),
  monto_centavos bigint not null check (monto_centavos > 0 and monto_centavos <= 1000000000),
  descripcion text not null check (char_length(descripcion) between 1 and 60),
  creado_por uuid references miembros(id),
  creado_en timestamptz not null default now(),
  editado_en timestamptz
);
create index if not exists gastos_pena on gastos (pena_id);
-- Detalle opcional del gasto: [{descripcion, monto_centavos}, ...]; la suma es monto_centavos.
alter table gastos add column if not exists conceptos jsonb;

-- Sin filas = el gasto se divide entre todos los asistentes.
create table if not exists gasto_participantes (
  gasto_id uuid not null references gastos(id) on delete cascade,
  miembro_id uuid not null references miembros(id),
  primary key (gasto_id, miembro_id)
);

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  pena_id uuid not null references penas(id) on delete cascade,
  de_miembro_id uuid not null references miembros(id),
  a_miembro_id uuid not null references miembros(id),
  monto_centavos bigint not null check (monto_centavos > 0),
  creado_en timestamptz not null default now()
);
create index if not exists pagos_pena on pagos (pena_id);
