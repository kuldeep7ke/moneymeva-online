import type { NextConfig } from "next";

const isGhPages = process.env.DEPLOY_TARGET === "gh-pages";
const basePath = isGhPages ? "/moneymeva-online" : "";

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  devIndicators: false,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
