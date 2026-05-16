/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      // Firebase Storage (for when you migrate off local disk)
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      // AWS S3 - restrict to known bucket patterns
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.s3.*.amazonaws.com' },
    ],
  },
}

export default nextConfig
