import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { borrarGasto, editarGasto } from "@/server/repo";

export async function PATCH(req: NextRequest, ctx: Ctx<{ codigo: string; id: string }>) {
  const { codigo, id } = await ctx.params;
  return handle(req, (body) => editarGasto(codigo, id, body));
}

export async function DELETE(req: NextRequest, ctx: Ctx<{ codigo: string; id: string }>) {
  const { codigo, id } = await ctx.params;
  return handle(req, () => borrarGasto(codigo, id));
}
