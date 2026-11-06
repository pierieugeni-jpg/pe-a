import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { editarPena, getPena } from "@/server/repo";

export async function GET(req: NextRequest, ctx: Ctx<{ codigo: string; id: string }>) {
  const { codigo, id } = await ctx.params;
  return handle(req, () => getPena(codigo, id));
}

export async function PATCH(req: NextRequest, ctx: Ctx<{ codigo: string; id: string }>) {
  const { codigo, id } = await ctx.params;
  return handle(req, (body) => editarPena(codigo, id, body));
}
