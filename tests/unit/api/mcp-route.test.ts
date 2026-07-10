// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";

const mockState = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test";
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://convex.example.test";

  return {
    mutationImpl: vi.fn(async (fnRef: unknown, args: unknown): Promise<unknown> => ({ ok: true })),
    queryImpl: vi.fn(async (fnRef: unknown, args: unknown): Promise<unknown> => null),
    instances: [] as Array<{
      setAuth: ReturnType<typeof vi.fn>;
      mutation: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
      url: string;
    }>,
  };
});

vi.mock("convex/browser", () => {
  class ConvexHttpClient {
    public readonly url: string;
    public readonly setAuth = vi.fn();
    public readonly mutation = vi.fn(async (fnRef: unknown, args: unknown) => {
      return await mockState.mutationImpl(fnRef, args);
    });
    public readonly query = vi.fn(async (fnRef: unknown, args: unknown) => {
      return await mockState.queryImpl(fnRef, args);
    });

    constructor(url: string) {
      this.url = url;
      mockState.instances.push(this);
    }
  }

  return { ConvexHttpClient };
});

import { POST as mcpPOST, OPTIONS as mcpOPTIONS } from "@/app/api/[transport]/route";
import { POST as registerPOST } from "@/app/register/route";
import { POST as tokenPOST, OPTIONS as tokenOPTIONS } from "@/app/token/route";
import { GET as authServerMetadataGET } from "@/app/.well-known/oauth-authorization-server/route";
import { GET as protectedResourceGET } from "@/app/.well-known/oauth-protected-resource/route";
import { GET as protectedResourceNestedGET } from "@/app/.well-known/oauth-protected-resource/api/mcp/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockState.instances = [];
  mockState.mutationImpl.mockReset();
  mockState.mutationImpl.mockResolvedValue({ ok: true });
  mockState.queryImpl.mockReset();
  mockState.queryImpl.mockResolvedValue(null);
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://convex.example.test";
});

function mcpRequest(body: unknown, authorization?: string) {
  const headers = new Headers({
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  });
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return new Request("https://app.example.test/api/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/mcp (streamable HTTP transport)", () => {
  it("returns 401 with WWW-Authenticate resource_metadata when unauthenticated", async () => {
    const response = await mcpPOST(
      mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
    );

    expect(response.status).toBe(401);
    const wwwAuthenticate = response.headers.get("WWW-Authenticate");
    expect(wwwAuthenticate).toContain("Bearer");
    expect(wwwAuthenticate).toContain(
      'resource_metadata="https://app.example.test/.well-known/oauth-protected-resource"'
    );
  });

  it("returns 401 for an invalid bearer token", async () => {
    mockState.queryImpl.mockResolvedValueOnce(null);

    const response = await mcpPOST(
      mcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }, "Bearer bpt_at_invalid")
    );

    expect(response.status).toBe(401);
    expect(mockState.queryImpl).toHaveBeenCalledTimes(1);
    const queryArgs = mockState.queryImpl.mock.calls[0][1] as { accessToken: string };
    expect(queryArgs.accessToken).toBe("bpt_at_invalid");
  });

  it("serves initialize for a valid bearer token", async () => {
    mockState.queryImpl.mockResolvedValueOnce({
      userId: "user-1",
      clientId: "bpt_client_abc",
      scope: undefined,
      expiresAt: Date.now() + 60_000,
    });

    const response = await mcpPOST(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test-client", version: "1.0.0" },
          },
        },
        "Bearer bpt_at_valid"
      )
    );

    expect(response.status).toBe(200);
    const bodyText = await response.text();
    expect(bodyText).toContain("betterpatchtool-mcp");
  });

  it("answers OPTIONS preflight with CORS headers", async () => {
    const response = mcpOPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Mcp-Session-Id");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("WWW-Authenticate");
  });
});

describe("POST /register (dynamic client registration)", () => {
  function registerRequest(body: unknown) {
    return new Request("https://app.example.test/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }

  it("maps RFC 7591 fields and returns 201", async () => {
    mockState.mutationImpl.mockResolvedValueOnce({
      clientId: "bpt_client_new",
      clientIdIssuedAt: 1_700_000_000,
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      tokenEndpointAuthMethod: "none",
      grantTypes: ["authorization_code", "refresh_token"],
      clientName: "Claude",
    });

    const response = await registerPOST(
      registerRequest({
        client_name: "Claude",
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      client_id: "bpt_client_new",
      client_id_issued_at: 1_700_000_000,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      client_name: "Claude",
      response_types: ["code"],
    });

    const mutationArgs = mockState.mutationImpl.mock.calls[0][1] as Record<string, unknown>;
    expect(mutationArgs).toMatchObject({
      clientName: "Claude",
      redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
      tokenEndpointAuthMethod: "none",
      grantTypes: ["authorization_code", "refresh_token"],
    });
  });

  it("maps invalid redirect URIs to invalid_redirect_uri", async () => {
    mockState.mutationImpl.mockRejectedValueOnce(
      new ConvexError("OAuth invalid_redirect_uri: redirect_uris must use https (or http on localhost)")
    );

    const response = await registerPOST(
      registerRequest({ redirect_uris: ["http://evil.example.com/cb"] })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("invalid_redirect_uri");
  });

  it("rejects malformed and oversized bodies", async () => {
    const malformed = await registerPOST(registerRequest("{not json"));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toBe("invalid_client_metadata");

    const oversized = await registerPOST(registerRequest(`{"client_name":"${"x".repeat(11_000)}"}`));
    expect(oversized.status).toBe(400);
    expect(mockState.mutationImpl).not.toHaveBeenCalled();
  });
});

describe("POST /token", () => {
  function tokenRequest(params: Record<string, string>) {
    return new Request("https://app.example.test/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
  }

  it("exchanges an authorization code and returns a refresh token", async () => {
    mockState.mutationImpl.mockResolvedValueOnce({
      accessToken: "bpt_at_x",
      refreshToken: "bpt_rt_x",
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: undefined,
    });

    const response = await tokenPOST(
      tokenRequest({
        grant_type: "authorization_code",
        client_id: "bpt_client_abc",
        code: "bpt_oac_code",
        redirect_uri: "https://claude.ai/api/mcp/auth_callback",
        code_verifier: "verifier",
        resource: "https://app.example.test/api/mcp",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload).toEqual({
      access_token: "bpt_at_x",
      refresh_token: "bpt_rt_x",
      token_type: "Bearer",
      expires_in: 3600,
    });

    const mutationArgs = mockState.mutationImpl.mock.calls[0][1] as Record<string, unknown>;
    expect(mutationArgs).toMatchObject({
      grantType: "authorization_code",
      clientId: "bpt_client_abc",
      resource: "https://app.example.test/api/mcp",
    });
    expect(mutationArgs.clientSecret).toBeUndefined();
  });

  it("supports the refresh_token grant", async () => {
    mockState.mutationImpl.mockResolvedValueOnce({
      accessToken: "bpt_at_y",
      refreshToken: "bpt_rt_y",
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: "mcp",
    });

    const response = await tokenPOST(
      tokenRequest({
        grant_type: "refresh_token",
        client_id: "bpt_client_abc",
        refresh_token: "bpt_rt_old",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      access_token: "bpt_at_y",
      refresh_token: "bpt_rt_y",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "mcp",
    });

    const mutationArgs = mockState.mutationImpl.mock.calls[0][1] as Record<string, unknown>;
    expect(mutationArgs).toEqual({
      grantType: "refresh_token",
      clientId: "bpt_client_abc",
      refreshToken: "bpt_rt_old",
    });
  });

  it("maps refresh reuse to invalid_grant", async () => {
    mockState.mutationImpl.mockRejectedValueOnce(new ConvexError("OAuth invalid refresh_token"));

    const response = await tokenPOST(
      tokenRequest({
        grant_type: "refresh_token",
        client_id: "bpt_client_abc",
        refresh_token: "bpt_rt_reused",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("invalid_grant");
  });

  it("rejects unsupported grant types", async () => {
    const response = await tokenPOST(
      tokenRequest({ grant_type: "client_credentials", client_id: "bpt_client_abc" })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("unsupported_grant_type");
    expect(mockState.mutationImpl).not.toHaveBeenCalled();
  });

  it("answers OPTIONS preflight", () => {
    const response = tokenOPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("well-known metadata", () => {
  it("authorization server metadata derives from NEXT_PUBLIC_APP_URL", async () => {
    const response = await authServerMetadataGET(
      new Request("http://internal-proxy:3000/.well-known/oauth-authorization-server")
    );
    const payload = await response.json();

    expect(payload).toMatchObject({
      issuer: "https://app.example.test",
      authorization_endpoint: "https://app.example.test/authorize",
      token_endpoint: "https://app.example.test/token",
      registration_endpoint: "https://app.example.test/register",
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      authorization_response_iss_parameter_supported: true,
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("protected resource metadata points at the MCP endpoint (root and path-insertion forms)", async () => {
    for (const handler of [protectedResourceGET, protectedResourceNestedGET]) {
      const response = handler(
        new Request("http://internal-proxy:3000/.well-known/oauth-protected-resource")
      );
      const payload = await response.json();

      expect(payload.resource).toBe("https://app.example.test/api/mcp");
      expect(payload.authorization_servers).toEqual(["https://app.example.test"]);
    }
  });
});
