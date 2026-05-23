import { SignJWT, jwtVerify } from "jose";

const SECRET = () => {
  const s = process.env.TOOL_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error("TOOL_JWT_SECRET must be set and at least 32 chars");
  }
  return new TextEncoder().encode(s);
};

export type ToolJwtClaims = {
  claim_id: string;
  user_id: string;
  session_id?: string;
};

const ISSUER = "fnol";
const AUDIENCE = "tavus-tool";

export async function mintToolJwt(
  claims: ToolJwtClaims,
  ttlSeconds = 60 * 60,
): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(SECRET());
}

export async function verifyToolJwt(token: string): Promise<ToolJwtClaims> {
  const { payload } = await jwtVerify(token, SECRET(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (
    typeof payload.claim_id !== "string" ||
    typeof payload.user_id !== "string"
  ) {
    throw new Error("invalid claims");
  }
  return {
    claim_id: payload.claim_id,
    user_id: payload.user_id,
    session_id:
      typeof payload.session_id === "string" ? payload.session_id : undefined,
  };
}
