import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { getCuentas } from "@/server/repo";

export async function GET(req: NextRequest, ctx: Ctx<{ codigo: string; id: string }>) {
  const { codigo, id } = await ctx.params;
  return handle(req, () => getCuentas(codigo, id));
}
