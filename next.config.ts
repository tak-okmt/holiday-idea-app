import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // src/engine/catalog.ts が readFileSync(`${process.cwd()}/data/activities.json`) を
  // 動的パスで読むため、Next.jsの自動ファイルトレースでは検出されない。
  // Vercelのサーバーレス関数にこのファイルが含まれず、本番で読み込みに失敗していたため明示する。
  outputFileTracingIncludes: {
    "/*": ["data/**/*"],
  },
};

export default nextConfig;
