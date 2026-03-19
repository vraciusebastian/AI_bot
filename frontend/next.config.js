/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',       // generates frontend/out/ for Electron to serve
  distDir: 'out',
  trailingSlash: true,    // /github → /github/index.html (works with static server)
  images: { unoptimized: true },
  reactStrictMode: true,
};

module.exports = nextConfig;
