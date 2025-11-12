/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable experimental features that cause issues on OneDrive
  experimental: {
    // Disable webpack build worker to avoid file system issues on Windows/OneDrive
    webpackBuildWorker: false,
  },
  // Allow images from localhost during development
  images: {
    domains: ['localhost'],
  },
  // Proxy API requests to Express backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
