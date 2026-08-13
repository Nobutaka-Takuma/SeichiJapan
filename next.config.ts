import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 はネイティブモジュールなのでバンドルせず require させる
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
