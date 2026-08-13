import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DBドライバはバンドルせず、実行時に読み込ませる
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
};

export default nextConfig;
