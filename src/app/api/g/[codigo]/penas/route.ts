import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { crearPena, listarPenas } from "@/server/repo";

export async function GET(req: NextRequest, ctx: Ctx<{ codigo: string }>) {
  const { codigo } = await ctx.params;
  return handle(req, () => listarPenas(codigo));
}

export async function POST(req: NextRequest, ctx: Ctx<{ codigo: string }>) {
  const { codigo } = await ctx.params;
  return handle(req, (body) => crearPena(codigo, body), 201);
}
