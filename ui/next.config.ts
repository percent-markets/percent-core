import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  compiler: {
    // Remove console.log in production but keep console.error and console.warn for debugging
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
