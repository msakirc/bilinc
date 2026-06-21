import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App uses no next/image component (only raw <img> + remote URLs), so image
  // optimization is dead weight. Disabling it also skips OpenNext's image-
  // optimization Lambda — which fails to bundle on Windows (mkdtemp ENOENT on the
  // colon in the abs temp path). Lets `sst deploy` run native on Windows, no WSL.
  images: { unoptimized: true },
};

export default nextConfig;
