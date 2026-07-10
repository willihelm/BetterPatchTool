import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";

// RFC 9728 path-insertion form: some clients derive the metadata URL by
// inserting /.well-known/oauth-protected-resource before the resource path
// (/api/mcp), so the same metadata is served here too.
const origin = process.env.NEXT_PUBLIC_APP_URL;

const handler = protectedResourceHandler({
  authServerUrls: origin ? [origin] : [],
  resourceUrl: origin ? `${origin}/api/mcp` : undefined,
});

export { handler as GET };
export const OPTIONS = metadataCorsOptionsRequestHandler();
