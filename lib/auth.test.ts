import { describe, expect, it } from "vitest";
import {
  ADMIN_COOKIE_NAME,
  createAdminToken,
  createParticipantToken,
  readAdminToken,
  readParticipantBearer,
  unauthorized,
} from "./auth";

const SECRET = "test-secret-key-that-is-at-least-32-characters";

describe("authentication boundaries", () => {
  it("accepts valid admin token", async () => {
    const token = await createAdminToken("admin-id", SECRET);

    await expect(readAdminToken(token, SECRET)).resolves.toEqual({
      success: true,
      data: { adminId: "admin-id" },
    });
  });

  it("rejects tampered admin token", async () => {
    const token = await createAdminToken("admin-id", SECRET);

    await expect(readAdminToken(`${token}x`, SECRET)).resolves.toEqual(unauthorized);
  });

  it("accepts participant bearer token", async () => {
    const token = await createParticipantToken({ participantId: "p1", sessionId: "s1" }, SECRET);

    await expect(readParticipantBearer(`Bearer ${token}`, SECRET)).resolves.toEqual({
      success: true,
      data: { participantId: "p1", sessionId: "s1" },
    });
  });

  it.each([undefined, "", "Basic abc", "Bearer malformed"])(
    "rejects absent or malformed participant bearer %s",
    async (header) => {
      await expect(readParticipantBearer(header, SECRET)).resolves.toEqual(unauthorized);
    },
  );

  it("uses stable admin cookie name", () => {
    expect(ADMIN_COOKIE_NAME).toBe("codearena_admin");
  });
});
