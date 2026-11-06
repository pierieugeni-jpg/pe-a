import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { getGrupo } from "@/server/repo";

export async function GET(req: NextRequest, ctx: Ctx<{ codigo: string }>) {
  const { codigo } = await ctx.params;
  return handle(req, () => getGrupo(codigo));
}
