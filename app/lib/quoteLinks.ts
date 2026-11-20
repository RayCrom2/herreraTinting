import "server-only";
import { createHash, randomBytes } from "node:crypto";

// createToken() output: 32 bytes in base64url is always 43 characters.
export const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 32 random bytes = 256 bits: unguessable, and URL-safe in base64url form.
export function createToken() {
  return randomBytes(32).toString("base64url");
}

// Only this hash is stored (quote_links.token_hash, booking_links.token_hash), never the token itself.
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Call after `await connection()` in a component: it reads the current time.
export function isLinkExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() < Date.now();
}

// SITE_URL without a trailing slash, so paths can be appended directly.
function siteUrl() {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL is not set");
  return url.replace(/\/$/, "");
}

export function quoteLinkUrl(token: string) {
  return `${siteUrl()}/q/${token}`;
}

export function bookingLinkUrl(token: string) {
  return `${siteUrl()}/book/${token}`;
}

