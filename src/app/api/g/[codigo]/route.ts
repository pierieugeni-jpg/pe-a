import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { borrarGrupo, getGrupo } from "@/server/repo";

export async function GET(req: NextRequest, ctx: Ctx<{ codigo: string }>) {
  const { codigo } = await ctx.params;
  return handle(req, () => getGrupo(codigo));
}

/** Requiere { codigo_creacion } en el cuerpo. */
export async function DELETE(req: NextRequest, ctx: Ctx<{ codigo: string }>) {
  const { codigo } = await ctx.params;
  return handle(req, (body) => borrarGrupo(codigo, body));
}
