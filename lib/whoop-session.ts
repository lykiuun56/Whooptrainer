import crypto from "crypto";
import { cookies } from "next/headers";

export const WHOOP_SESSION_COOKIE = "whoop_session";

export type WhoopSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  token_type: string;
  scope?: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.WHOOP_CLIENT_SECRET;

  if (!secret) {
    throw new Error("Missing AUTH_SECRET");
  }

  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSession(session: WhoopSession) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSession(value: string): WhoopSession {
  const raw = Buffer.from(value, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getSecret(), iv);

  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");

  return JSON.parse(decrypted) as WhoopSession;
}

export async function getWhoopSession() {
  const cookieStore = await cookies();
  const value = cookieStore.get(WHOOP_SESSION_COOKIE)?.value;

  if (!value) {
    return null;
  }

  try {
    return decryptSession(value);
  } catch {
    return null;
  }
}

export async function setWhoopSession(session: WhoopSession) {
  const cookieStore = await cookies();

  cookieStore.set(WHOOP_SESSION_COOKIE, encryptSession(session), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearWhoopSession() {
  const cookieStore = await cookies();

  cookieStore.delete(WHOOP_SESSION_COOKIE);
}
