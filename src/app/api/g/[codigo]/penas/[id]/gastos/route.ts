import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { crearGasto } from "@/server/repo";

export async function POST(req: NextRequest, ctx: Ctx<{ codigo: string; id: string }>) {
  const { codigo, id } = await ctx.params;
  return handle(req, (body) => crearGasto(codigo, id, body), 201);
}
