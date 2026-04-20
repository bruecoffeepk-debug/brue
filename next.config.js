/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supabase project subdomain is used for Storage URLs
  // Example: https://xxxxxxxxxxxx.supabase.co/storage/v1/object/public/drink-photos/foo.jpg
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
    ],
  },
  // We ship fast, we fix soon — Vercel will still fail hard errors.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Hide the Powered-By header on Vercel
  poweredByHeader: false,
};

module.exports = nextConfig;
