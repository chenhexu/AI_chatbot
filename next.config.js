/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Node.js-only libraries (pdfjs-dist, canvas, tesseract.js) only used in API routes
    if (!isServer) {
      // On client, make sure these Node.js modules aren't bundled
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        canvas: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig


