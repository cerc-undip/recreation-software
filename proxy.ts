import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, readAdminToken, unauthorized } from "@/lib/auth";
import { env } from "@/lib/env";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/admin/login" || path === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const result = token ? await readAdminToken(token, env.JWT_SECRET) : unauthorized;

  if (result.success) {
    return NextResponse.next();
  }

  if (path.startsWith("/api/admin/")) {
    return NextResponse.json(unauthorized, { status: 401 });
  }

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
