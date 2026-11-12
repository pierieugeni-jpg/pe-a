# Peña · Cuentas claras

App web (mobile first, instalable como PWA) para dividir los gastos de una peña entre amigos y saber quién le transfiere a quién.

## Correr en local

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests del cálculo (Vitest)
```

Sin configurar nada, usa **PGlite** (Postgres embebido) y guarda los datos en `./.data`.
Para probar desde el celular en la misma red: `npx next dev -H 0.0.0.0` y entrar a `http://<IP-de-la-PC>:3000`
(copiar al portapapeles usa un método alternativo en http).

## Producción (Vercel + Supabase)

1. Crear un proyecto en Supabase y copiar la connection string del **Transaction pooler** (puerto 6543).
2. En Vercel, importar el repo y definir `DATABASE_URL` con esa string, y `CODIGO_CREACION` con el código
   que hay que escribir para crear un grupo (sin esa variable, en Vercel no se pueden crear grupos).
   Entrar a un grupo existente con su link no pide el código. El mismo código permite eliminar un grupo
   entero (pantalla Miembros → Eliminar grupo).
3. Las tablas se crean solas al primer pedido (o pegá `db/schema.sql` en el SQL Editor).

> PGlite no sirve en Vercel (el disco no persiste): en producción `DATABASE_URL` es obligatoria.
> Revisá los límites vigentes de los planes gratuitos antes de arrancar.

## Estructura

| Ruta | Qué hay |
|---|---|
| `src/lib/cuentas.ts` | Función pura de cálculo: saldos, redondeo en centavos, transferencias sugeridas |
| `src/lib/cuentas.test.ts` | Tests (incluye los criterios de aceptación) |
| `src/lib/montos.ts` | Formato y parseo es-AR (`$12.500,50`) |
| `src/lib/resumen.ts` | Texto para WhatsApp |
| `src/server/repo.ts` | Lógica y validaciones del servidor |
| `src/server/db.ts` | Adaptador Postgres / PGlite |
| `src/server/http.ts` | Manejo de errores y límite de intentos por IP |
| `src/app/api/...` | API REST bajo `/api/g/{codigo}` |
| `src/app/g/[codigo]/...` | Pantallas P1–P6 |

## Decisiones de implementación (además de las del spec)

- **"Todos" se guarda como todos**: si un gasto se divide entre todos los asistentes no se guardan filas en
  `gasto_participantes`, así quien se suma después a la peña también participa. Si se excluyó a alguien,
  se guarda la lista explícita y los que se suman después no entran en ese gasto.
- **Marcar pagos**: el servidor solo acepta marcar una transferencia que esté sugiriendo en ese momento.
  Evita pagos duplicados si dos personas tocan "Marcar pagada" a la vez.
- **Sacar asistentes**: además de quien pagó un gasto, se bloquea sacar a quien tiene pagos marcados o
  es el único participante de un gasto.
- **Cerrar** solo se permite con todo saldado; una peña cerrada tampoco acepta marcar o desmarcar pagos.
- **Límite por IP**: 240 pedidos por minuto y 20 códigos de grupo inválidos cada 15 minutos. Es en memoria:
  en serverless cada instancia lleva su propia cuenta.
- **Mínimo de transferencias**: se parte a la gente en la mayor cantidad posible de grupos cuyos saldos suman 0
  (programación dinámica, hasta 16 personas con saldo; con más, greedy) y cada grupo se salda aparte.
- **Alias**: cada uno carga solo el suyo (el navegador manda quién es en `editado_por`; no hay login).
- **Conceptos**: un gasto puede tener varios conceptos del mismo ticket (columna `conceptos` jsonb). Mismo pagador y
  misma división; el monto es la suma y la descripción se arma con los nombres.
- El código de acceso tiene 12 caracteres aleatorios (31 símbolos, ~59 bits).
- Íconos: `npm run icons` los regenera (`scripts/generar-iconos.mjs`).
