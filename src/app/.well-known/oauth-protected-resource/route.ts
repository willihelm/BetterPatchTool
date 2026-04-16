export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  return Response.json({
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
  });
}
