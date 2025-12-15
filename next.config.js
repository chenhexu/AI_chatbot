/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exclude native Node.js modules from server-side bundling
  serverExternalPackages: ['canvas', 'pdfjs-dist', 'tesseract.js', 'pdf-parse'],
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
    } else {
      // On server, mark native modules as external (don't bundle them)
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('canvas', 'pdfjs-dist', 'tesseract.js');
      } else {
        config.externals = [
          config.externals,
          'canvas',
          'pdfjs-dist',
          'tesseract.js',
        ];
      }
    }
    
    return config;
  },
}

module.exports = nextConfig


