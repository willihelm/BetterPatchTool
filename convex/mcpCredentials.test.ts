/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("mcpCredentials", () => {
  it("creates and lists client credentials for the current user", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "agent-user", issuer: "convex" });

    const created = await asUser.mutation(api.mcpCredentials.create, { name: "Claude Desktop" });

    expect(created.clientId.startsWith("bpt_client_")).toBe(true);
    expect(created.clientSecret.startsWith("bpt_secret_")).toBe(true);

    const listed = await asUser.query(api.mcpCredentials.list, {});
    expect(listed).toHaveLength(1);
    expect(listed[0].name).toBe("Claude Desktop");
    expect(listed[0].clientId).toBe(created.clientId);
  });

  it("deletes credentials and blocks credential authentication afterward", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ subject: "agent-user", issuer: "convex" });

    const created = await asUser.mutation(api.mcpCredentials.create, { name: "Temp credentials" });
    const authBeforeDelete = await t.mutation(api.mcpCredentials.authenticateByClientCredentials, {
      clientId: created.clientId,
      clientSecret: created.clientSecret,
    });
    expect(authBeforeDelete?.userId).toBe("agent-user");

    await asUser.mutation(api.mcpCredentials.remove, { credentialId: created.credentialId });
    const authAfterDelete = await t.mutation(api.mcpCredentials.authenticateByClientCredentials, {
      clientId: created.clientId,
      clientSecret: created.clientSecret,
    });
    expect(authAfterDelete).toBeNull();
  });
});
