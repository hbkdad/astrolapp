/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The engine packages are TypeScript source in this workspace, so Next must
  // transpile them rather than expecting pre-built JavaScript.
  transpilePackages: [
    '@astrolapp/shared',
    '@astrolapp/astro-engine',
    '@astrolapp/numerology-engine',
    '@astrolapp/context-engine',
    '@astrolapp/interpretation-engine',
    '@astrolapp/db',
  ],
  eslint: {
    // Linting is run from the workspace root, not during the build.
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // The engine packages are ESM TypeScript and import siblings with an
    // explicit `.js` extension, as the spec requires. Those files are `.ts` on
    // disk, so webpack needs to be told the mapping; TypeScript already applies
    // it under `moduleResolution: Bundler`.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
