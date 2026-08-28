import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminFromCookie } from "@/lib/auth";
import type { Session } from "@prisma/client";

export type AdminSessionResult =
  | { ok: true; adminId: string; session: Session & { problemCount: number } }
  | { ok: false; response: Response };

/**
 * Authenticated admin session loader: verifies the admin cookie, resolves the
 * session by id, and returns its assigned problem count.
 */
export async function loadSessionForAdmin(
  request: NextRequest,
  id: string,
): Promise<AdminSessionResult> {
  const admin = await getAdminFromCookie(request);
  if (!admin.success) {
    return { ok: false, response: Response.json(admin, { status: 401 }) };
  }

  const session = await prisma.session.findUnique({
    where: { id },
    include: { _count: { select: { problemLinks: true } } },
  });
  if (!session) {
    return {
      ok: false,
      response: Response.json({ success: false, error: "Session not found" }, { status: 404 }),
    };
  }

  const { _count, ...fields } = session;
  return {
    ok: true,
    adminId: admin.data.adminId,
    session: { ...fields, problemCount: _count.problemLinks },
  };
}

export function jsonError(error: string, status: number): Response {
  return Response.json({ success: false, error }, { status });
}

export function jsonData<T>(data: T): Response {
  return Response.json({ success: true, data });
}
