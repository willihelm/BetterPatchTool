function toBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(digest));
}

export function createOpaqueToken(prefix: string) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${prefix}_${toBase64Url(bytes)}`;
}

// RFC 8707 audience check for issued tokens. Tokens minted before audience
// binding was introduced carry no resource and stay valid until their natural
// (<= 1 h) expiry. When MCP_RESOURCE_URL is unset (local dev), enforcement is off.
export function isAllowedTokenAudience(resource: string | undefined) {
  if (resource === undefined) return true;
  const expected = process.env.MCP_RESOURCE_URL;
  if (!expected) return true;
  return resource === expected;
}

export function isSupportedRedirectUri(redirectUri: string) {
  try {
    const url = new URL(redirectUri);
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
