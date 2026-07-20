/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produce a self-contained server bundle for a small production image.
  output: "standalone",
  // The agent API base URL is read server-side in the /api/chat proxy route.
  env: {
    AGENT_API_URL: process.env.AGENT_API_URL || "http://localhost:8002",
  },
};

module.exports = nextConfig;
