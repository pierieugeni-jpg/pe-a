import type { NextRequest } from "next/server";
import { handle, type Ctx } from "@/server/http";
import { borrarPago } from "@/server/repo";

export async function DELETE(req: NextRequest, ctx: Ctx<{ codigo: string; id: string; pagoId: string }>) {
  const { codigo, id, pagoId } = await ctx.params;
  return handle(req, () => borrarPago(codigo, id, pagoId));
}
