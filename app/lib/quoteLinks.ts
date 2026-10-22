import "server-only";
import { createHash, randomBytes } from "node:crypto";

// createQuoteToken() output: 32 bytes in base64url is always 43 characters.
export const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 32 random bytes = 256 bits: unguessable, and URL-safe in base64url form.
export function createQuoteToken() {
  return randomBytes(32).toString("base64url");
}

// Only this hash is stored (quote_links.token_hash), never the token itself.
export function hashQuoteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Call after `await connection()` in a component: it reads the current time.
export function isLinkExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() < Date.now();
}

export function quoteLinkUrl(token: string) {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) throw new Error("SITE_URL is not set");
  return `${siteUrl.replace(/\/$/, "")}/q/${token}`;
}


