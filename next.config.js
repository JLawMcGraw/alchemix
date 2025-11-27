/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable experimental features that cause issues on OneDrive
  experimental: {
    // Disable webpack build worker to avoid file system issues on Windows/OneDrive
    webpackBuildWorker: false,
  },
  // Strip console.log statements in production builds
  // Note: This uses SWC compiler (Webpack). If using Turbopack (--turbo flag),
  // this config is ignored in dev but still applies to production builds.
  compiler: {
    removeConsole: {
      exclude: ['error'],  // Keep console.error for critical debugging
    },
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
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
