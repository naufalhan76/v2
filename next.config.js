/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  
  // 🚀 Compiler optimizations
  compiler: {
    // Remove console.logs in production (except error & warn)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn', 'info']
    } : false,
  },
  
  // 🔥 Experimental optimizations for faster builds and runtime
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: [
      'lucide-react',      // Icons library
      'date-fns',          // Date utilities
      'recharts',          // Charts library
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs'
    ],
  },
  
  // 🖼️ Image optimization configuration
  images: {
    domains: ['ybxnosmcjubuezefofko.supabase.co'],
    formats: ['image/avif', 'image/webp'], // Modern image formats
    minimumCacheTTL: 60, // Cache images for 60 seconds
  },
  
  // ⚡ Caching headers for better performance
  async headers() {
    return [
      {
        // Cache static assets aggressively
        source: '/:path*\\.(js|css|woff|woff2|png|jpg|jpeg|svg|ico)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Dashboard pages with short cache + stale-while-revalidate
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
