import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/entrar", req.url), 303);
  res.cookies.delete(COOKIE_SESION);
  return res;
}
