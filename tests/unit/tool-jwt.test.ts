import { describe, expect, it, beforeAll } from "vitest";
import { mintToolJwt, verifyToolJwt } from "@/lib/auth/tool-jwt";

beforeAll(() => {
  process.env.TOOL_JWT_SECRET =
    "test-secret-test-secret-test-secret-test-secret";
});

describe("tool JWT", () => {
  it("mints and round-trips claims", async () => {
    const token = await mintToolJwt({
      claim_id: "11111111-1111-1111-1111-111111111111",
      user_id: "22222222-2222-2222-2222-222222222222",
      session_id: "33333333-3333-3333-3333-333333333333",
    });
    const claims = await verifyToolJwt(token);
    expect(claims.claim_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(claims.user_id).toBe("22222222-2222-2222-2222-222222222222");
    expect(claims.session_id).toBe("33333333-3333-3333-3333-333333333333");
  });

  it("rejects a tampered token", async () => {
    const token = await mintToolJwt({
      claim_id: "c",
      user_id: "u",
    });
    await expect(verifyToolJwt(token + "x")).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await mintToolJwt({ claim_id: "c", user_id: "u" }, -1);
    await expect(verifyToolJwt(token)).rejects.toThrow();
  });
});
