/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker production builds
  // Creates a minimal standalone folder with only necessary files
  output: 'standalone',
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
  // Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              "connect-src 'self' http://localhost:3000 http://localhost:8080",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
