/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
}

export default nextConfig
