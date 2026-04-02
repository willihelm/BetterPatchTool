export default {
  providers: [
    {
      // In deployed Convex environments, CONVEX_SITE_URL is canonical.
      // Keep NEXT_PUBLIC_CONVEX_SITE_URL as a fallback for local/dev compatibility.
      domain: process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
