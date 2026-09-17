/** @type {import('next').NextConfig} */

// ── Security headers (OWASP A02:2025 — Security Misconfiguration) ──
// CSP is deliberately permissive on script/style ('unsafe-inline') so Next.js
// hydration and Leaflet inline styles keep working, but locks the real levers:
// frame-ancestors (anti-clickjacking), connect-src (only our API + Open-Meteo),
// object-src none, base-uri self. img-src allows https: so satellite tiles load.
// If the live map ever blanks after deploy, widen ONLY the directive at fault.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://api.open-meteo.com",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: false, // the sim uses one rAF loop; strict double-invoke would start two
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
