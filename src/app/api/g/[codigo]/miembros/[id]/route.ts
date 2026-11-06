import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { editarMiembro } from "@/server/repo";

export async function PATCH(req: NextRequest, ctx: Ctx<{ codigo: string; id: string }>) {
  const { codigo, id } = await ctx.params;
  return handle(req, (body) => editarMiembro(codigo, id, body));
}
