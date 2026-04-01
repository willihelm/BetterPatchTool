const TOKEN_BYTE_LENGTH = 32;
const CLIENT_ID_BYTE_LENGTH = 12;
const DEV_FALLBACK_PEPPER = "development-only-mcp-token-pepper";
let hasLoggedMissingPepperWarning = false;

function getPepper() {
  const pepper = process.env.MCP_TOKEN_PEPPER;
  if (pepper && pepper.trim().length > 0) return pepper;

  if (process.env.NODE_ENV === "development") {
    if (!hasLoggedMissingPepperWarning) {
      hasLoggedMissingPepperWarning = true;
      console.warn(
        "MCP_TOKEN_PEPPER is not configured. Falling back to an insecure development pepper. " +
          "Set MCP_TOKEN_PEPPER with `bunx convex env set MCP_TOKEN_PEPPER <long-random-secret>`."
      );
    }
    return DEV_FALLBACK_PEPPER;
  }

  if (process.env.NODE_ENV === "test" || process.env.VITEST === "true") {
    return "test-mcp-token-pepper";
  }
  throw new Error(
    "MCP token pepper is not configured. Set MCP_TOKEN_PEPPER in your Convex deployment environment."
  );
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createMcpClientId() {
  const bytes = crypto.getRandomValues(new Uint8Array(CLIENT_ID_BYTE_LENGTH));
  return `bpt_client_${toHex(bytes)}`;
}

export function createMcpClientSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTE_LENGTH));
  return `bpt_secret_${toHex(bytes)}`;
}

export async function hashMcpValue(value: string) {
  const pepper = getPepper();
  const bytes = new TextEncoder().encode(`${value}:${pepper}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

export async function hashMcpClientSecret(clientId: string, clientSecret: string) {
  return await hashMcpValue(`${clientId}:${clientSecret}`);
}

export function constantTimeEqual(a: string, b: string) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  let diff = aBytes.length ^ bBytes.length;
  const maxLength = Math.max(aBytes.length, bBytes.length);

  for (let i = 0; i < maxLength; i++) {
    const left = i < aBytes.length ? aBytes[i] : 0;
    const right = i < bBytes.length ? bBytes[i] : 0;
    diff |= left ^ right;
  }

  return diff === 0;
}
