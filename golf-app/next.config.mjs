/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  // Reduce memory during build
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
