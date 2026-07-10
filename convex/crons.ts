import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const CLEANUP_BATCH_SIZE = 200;
const UNUSED_CLIENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Daily sweep of expired OAuth artifacts and decayed DCR client registrations.
// Each table is processed in bounded batches; if any batch was full the
// mutation reschedules itself so a single run stays within transaction limits.
export const cleanupMcpOAuth = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let moreWork = false;

    const expiredCodes = await ctx.db
      .query("mcpOAuthAuthorizationCodes")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(CLEANUP_BATCH_SIZE);
    for (const code of expiredCodes) {
      await ctx.db.delete(code._id);
    }
    moreWork ||= expiredCodes.length === CLEANUP_BATCH_SIZE;

    const expiredAccessTokens = await ctx.db
      .query("mcpOAuthAccessTokens")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(CLEANUP_BATCH_SIZE);
    for (const token of expiredAccessTokens) {
      await ctx.db.delete(token._id);
    }
    moreWork ||= expiredAccessTokens.length === CLEANUP_BATCH_SIZE;

    const expiredRefreshTokens = await ctx.db
      .query("mcpOAuthRefreshTokens")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(CLEANUP_BATCH_SIZE);
    for (const token of expiredRefreshTokens) {
      await ctx.db.delete(token._id);
    }
    moreWork ||= expiredRefreshTokens.length === CLEANUP_BATCH_SIZE;

    // Open DCR spam decay: registrations that never reached an authorization
    // (or went stale) disappear after 30 days. lastUsedAt is always set at
    // registration and bumped on authorize/refresh.
    const staleClients = await ctx.db
      .query("mcpOAuthClients")
      .withIndex("by_lastUsedAt", (q) => q.lt("lastUsedAt", now - UNUSED_CLIENT_TTL_MS))
      .take(CLEANUP_BATCH_SIZE);
    for (const client of staleClients) {
      await ctx.db.delete(client._id);
    }
    moreWork ||= staleClients.length === CLEANUP_BATCH_SIZE;

    if (moreWork) {
      await ctx.scheduler.runAfter(0, internal.crons.cleanupMcpOAuth, {});
    }
    return null;
  },
});

const crons = cronJobs();

crons.interval("cleanup expired mcp oauth data", { hours: 24 }, internal.crons.cleanupMcpOAuth, {});

export default crons;
