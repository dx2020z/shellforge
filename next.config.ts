import type { NextConfig } from 'next';
const config: NextConfig = { poweredByHeader: false, outputFileTracingRoot: process.cwd(), experimental: { cpus: 1 }, devIndicators: false };
export default config;
