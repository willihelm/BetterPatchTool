const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// RFC 8414 authorization server metadata. The issuer is the canonical app
// origin (NEXT_PUBLIC_APP_URL), not the request origin, so proxies and preview
// hosts cannot change the advertised endpoints.
export async function GET(request: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/authorize`,
      token_endpoint: `${origin}/token`,
      registration_endpoint: `${origin}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      authorization_response_iss_parameter_supported: true,
    },
    { headers: CORS_HEADERS }
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
