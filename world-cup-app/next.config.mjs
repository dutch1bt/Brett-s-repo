/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  images: {
    domains: ['localhost'],
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  productionBrowserSourceMaps: false,
  output: 'standalone',
};

export default nextConfig;
