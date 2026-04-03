/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  // Disable source maps in production to save memory during build
  productionBrowserSourceMaps: false,
  // Reduce output size
  output: 'standalone',
};

export default nextConfig;
