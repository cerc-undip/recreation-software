import type { NextConfig } from "next";
import "./lib/env";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname, "../../.."),
  },
};

export default nextConfig;
