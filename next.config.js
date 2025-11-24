/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // pdf-parse is a Node.js-only library, only used in API routes
    if (!isServer) {
      // On client, make sure these Node.js modules aren't bundled
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig


