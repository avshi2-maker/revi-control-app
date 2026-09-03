/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // the sim uses one rAF loop; strict double-invoke would start two
};
export default nextConfig;
