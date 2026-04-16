export async function POST() {
  return Response.json(
    {
      error: "unsupported_operation",
      error_description: "Dynamic client registration is not supported. Configure OAuth client ID/secret manually.",
    },
    { status: 400 }
  );
}
