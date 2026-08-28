import { z } from "zod";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth";
import { env } from "@/lib/env";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, error: "Invalid credentials" }, { status: 401 });
  }

  const admin = await prisma.admin.findUnique({ where: { username: parsed.data.username } });
  if (!admin || !(await verifyPassword(parsed.data.password, admin.password))) {
    return Response.json({ success: false, error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createAdminToken(admin.id, env.JWT_SECRET);
  const res = Response.json({ success: true, data: { adminId: admin.id } });

  const isProd = process.env.NODE_ENV === "production";
  res.headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=43200; SameSite=${isProd ? "Strict" : "Lax"}${isProd ? "; Secure" : ""}`,
  );
  return res;
}

export const dynamic = "force-dynamic";
