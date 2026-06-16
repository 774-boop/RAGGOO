import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["faiss-node"],
  allowedDevOrigins: ["192.168.100.73"],
};

export default nextConfig;
