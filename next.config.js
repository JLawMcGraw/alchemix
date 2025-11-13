/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable experimental features that cause issues on OneDrive
  experimental: {
    // Disable webpack build worker to avoid file system issues on Windows/OneDrive
    webpackBuildWorker: false,
  },
  // Windows/OneDrive optimization: Disable file system watching that causes hangs
  webpack: (config, { isServer }) => {
    // Disable watch options polling for OneDrive compatibility
    config.watchOptions = {
      poll: false,
      ignored: /node_modules/,
    };
    return config;
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
