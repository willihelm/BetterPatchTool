import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => {
  return {
    sessionToken: null as string | null,
    mutationImpl: vi.fn(async (fnRef: unknown, args: unknown) => ({ ok: true })),
    instances: [] as Array<{
      setAuth: ReturnType<typeof vi.fn>;
      mutation: ReturnType<typeof vi.fn>;
      url: string;
    }>,
  };
});

vi.mock("@convex-dev/auth/nextjs/server", () => ({
  convexAuthNextjsToken: vi.fn(async () => mockState.sessionToken),
}));

vi.mock("convex/browser", () => {
  class ConvexHttpClient {
    public readonly url: string;
    public readonly setAuth = vi.fn();
    public readonly mutation = vi.fn(async (fnRef: unknown, args: unknown) => {
      return await mockState.mutationImpl(fnRef, args);
    });

    constructor(url: string) {
      this.url = url;
      mockState.instances.push(this);
    }
  }

  return { ConvexHttpClient };
});

import { POST } from "@/app/api/mcp/route";

function makeRequest(body: unknown, authorization?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) {
    headers.set("authorization", authorization);
  }

  return new Request("http://localhost:3000/api/mcp", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/mcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.sessionToken = null;
    mockState.instances = [];
    mockState.mutationImpl.mockReset();
    mockState.mutationImpl.mockResolvedValue({ ok: true });
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://convex.example.test";
  });

  it("returns parse error for invalid JSON", async () => {
    const request = makeRequest("{not-valid-json");
    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: "Parse error" },
    });
  });

  it("allows initialize without authentication", async () => {
    const request = makeRequest({ jsonrpc: "2.0", id: 1, method: "initialize" });
    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("MCP-Protocol-Version")).toBe("2025-03-26");
    expect(payload.result.serverInfo.name).toBe("betterpatchtool-mcp");
    expect(mockState.instances).toHaveLength(0);
  });

  it("rejects tools/list without auth", async () => {
    const request = makeRequest({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} });
    const response = await POST(request);
    const payload = await response.json();

    expect(payload).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: -32001,
        message: "unauthorized",
        data: { code: "unauthorized" },
      },
    });
  });

  it("calls executeTool with bearer token", async () => {
    mockState.mutationImpl.mockResolvedValueOnce([{ _id: "project-1" }]);

    const request = makeRequest(
      {
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "list_projects",
          arguments: {},
        },
      },
      "Bearer test-oauth-token"
    );

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockState.instances).toHaveLength(1);
    expect(mockState.instances[0].setAuth).toHaveBeenCalledWith("test-oauth-token");
    expect(mockState.instances[0].mutation).toHaveBeenCalledTimes(1);

    const mutationArgs = mockState.instances[0].mutation.mock.calls[0][1] as {
      name: string;
      args: Record<string, unknown>;
    };
    expect(mutationArgs.name).toBe("list_projects");
    expect(mutationArgs.args).toEqual({});
    expect(payload.result.structuredContent).toEqual([{ _id: "project-1" }]);
  });

  it("calls executeToolWithClientCredentials with basic auth", async () => {
    mockState.mutationImpl.mockResolvedValueOnce([{ _id: "project-2" }]);
    const encoded = btoa("bpt_client_abc:bpt_secret_abc");

    const request = makeRequest(
      {
        jsonrpc: "2.0",
        id: "cred",
        method: "tools/call",
        params: {
          name: "list_projects",
          arguments: {},
        },
      },
      `Basic ${encoded}`
    );

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockState.instances).toHaveLength(1);
    expect(mockState.instances[0].setAuth).not.toHaveBeenCalled();

    const mutationArgs = mockState.instances[0].mutation.mock.calls[0][1] as {
      clientId: string;
      clientSecret: string;
      name: string;
      args: Record<string, unknown>;
    };

    expect(mutationArgs).toMatchObject({
      clientId: "bpt_client_abc",
      clientSecret: "bpt_secret_abc",
      name: "list_projects",
      args: {},
    });
    expect(payload.result.structuredContent).toEqual([{ _id: "project-2" }]);
  });

  it("uses session token when no authorization header is present", async () => {
    mockState.sessionToken = "session-token-1";

    const request = makeRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "list_projects",
        arguments: {},
      },
    });

    await POST(request);

    expect(mockState.instances).toHaveLength(1);
    expect(mockState.instances[0].setAuth).toHaveBeenCalledWith("session-token-1");
  });

  it("maps MCP errors to JSON-RPC errors", async () => {
    mockState.mutationImpl.mockRejectedValueOnce(new Error("MCP_ERROR:forbidden:No write access"));

    const request = makeRequest(
      {
        jsonrpc: "2.0",
        id: 99,
        method: "tools/call",
        params: {
          name: "update_project_meta",
          arguments: { projectId: "p1", title: "X" },
        },
      },
      "Bearer editor-token"
    );

    const response = await POST(request);
    const payload = await response.json();

    expect(payload).toEqual({
      jsonrpc: "2.0",
      id: 99,
      error: {
        code: -32003,
        message: "forbidden",
        data: { code: "forbidden", message: "No write access" },
      },
    });
  });

  it("rejects invalid batch size", async () => {
    const oversizedBatch = Array.from({ length: 21 }, (_, idx) => ({
      jsonrpc: "2.0",
      id: idx,
      method: "ping",
    }));

    const response = await POST(makeRequest(oversizedBatch));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32600,
        message: "Invalid Request",
      },
    });
  });

  it("returns internal error when convex endpoint is not configured", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    const response = await POST(
      makeRequest(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "list_projects",
            arguments: {},
          },
        },
        "Bearer token"
      )
    );

    const payload = await response.json();

    expect(payload).toEqual({
      jsonrpc: "2.0",
      id: 3,
      error: {
        code: -32603,
        message: "MCP endpoint is not configured",
        data: { code: "internal_error" },
      },
    });
    expect(mockState.instances).toHaveLength(0);
  });
});
