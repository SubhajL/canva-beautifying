/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    // During development, we'll fix these errors. For now, ignore during builds.
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Also ignore TypeScript errors for now (we can fix them later)
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Suppress critical dependency warnings from third-party packages
    config.module.exprContextCritical = false;
    
    // Ignore specific warnings from Sentry and BullMQ
    config.ignoreWarnings = [
      {
        module: /node_modules\/@sentry/,
        message: /Critical dependency/,
      },
      {
        module: /node_modules\/bullmq/,
        message: /Critical dependency/,
      },
      {
        module: /node_modules\/require-in-the-middle/,
        message: /Critical dependency/,
      },
    ];
    
    return config;
  },
};

export default nextConfig;