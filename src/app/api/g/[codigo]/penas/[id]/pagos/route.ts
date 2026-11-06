import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { crearPago } from "@/server/repo";

export async function POST(req: NextRequest, ctx: Ctx<{ codigo: string; id: string }>) {
  const { codigo, id } = await ctx.params;
  return handle(req, (body) => crearPago(codigo, id, body), 201);
}
