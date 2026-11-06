import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { crearMiembro } from "@/server/repo";

export async function POST(req: NextRequest, ctx: Ctx<{ codigo: string }>) {
  const { codigo } = await ctx.params;
  return handle(req, (body) => crearMiembro(codigo, body), 201);
}
