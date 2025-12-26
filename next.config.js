/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Exclude heavy native Node.js modules from server-side bundling
  serverExternalPackages: ['canvas', 'pdfjs-dist', 'tesseract.js', 'pdf-parse', 'sharp'],
  
  // Exclude heavy dependencies from serverless function output
  // This is critical for Vercel's 250MB limit
  outputFileTracingExcludes: {
    '/api/chat': [
      './node_modules/canvas/**',
      './node_modules/pdfjs-dist/**',
      './node_modules/tesseract.js/**',
      './node_modules/pdf-parse/**',
      './node_modules/sharp/**',
      './lib/documentLoader.ts',
      './lib/documentProcessors/**',
      './data/**',
    ],
    '/api/migrate': [
      './node_modules/canvas/**',
      './node_modules/pdfjs-dist/**',
      './node_modules/tesseract.js/**',
      './node_modules/sharp/**',
      './data/**',
    ],
    '/api/health': [
      './node_modules/canvas/**',
      './node_modules/pdfjs-dist/**',
      './node_modules/tesseract.js/**',
      './node_modules/pdf-parse/**',
      './node_modules/sharp/**',
    ],
  },
  
  webpack: (config, { isServer }) => {
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
        config.externals.push('canvas', 'pdfjs-dist', 'tesseract.js', 'pdf-parse');
      } else {
        config.externals = [
          config.externals,
          'canvas',
          'pdfjs-dist',
          'tesseract.js',
          'pdf-parse',
        ];
      }
    }
    
    return config;
  },
}

module.exports = nextConfig
