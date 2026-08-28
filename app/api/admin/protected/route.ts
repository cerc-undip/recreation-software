import { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, readAdminToken, unauthorized } from "@/lib/auth";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const result = token
    ? await readAdminToken(token, env.JWT_SECRET)
    : unauthorized;

  if (!result.success) {
    return Response.json(result, { status: 401 });
  }
  return Response.json({ success: true, data: { adminId: result.data.adminId } });
}

export const dynamic = "force-dynamic";
