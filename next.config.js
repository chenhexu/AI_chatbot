/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exclude native Node.js modules from server-side bundling
  serverExternalPackages: ['canvas', 'pdfjs-dist', 'tesseract.js', 'pdf-parse'],
  webpack: (config, { isServer, webpack }) => {
    // Configure path aliases to match tsconfig.json
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname),
    };
    
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
      
      // Note: pdfjs-dist/legacy/build/pdf.js is loaded dynamically at runtime
      // The dynamic require() with join() prevents Next.js from statically analyzing it
    }
    
    return config;
  },
}

module.exports = nextConfig


