import type { NextRequest } from "next/server";
import { handle } from "@/server/http";
import { crearGrupo } from "@/server/repo";

export async function POST(req: NextRequest) {
  return handle(req, (body) => crearGrupo(body), 201);
}
