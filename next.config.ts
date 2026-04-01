import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const isDevelopment = process.env.NODE_ENV !== "production";
const scriptSrc = isDevelopment
  ? "'self' 'unsafe-inline' 'unsafe-eval' https:"
  : "'self' 'unsafe-inline' https:";
const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const firebaseAuthFrameSrc = firebaseAuthDomain
  ? ` https://${firebaseAuthDomain}`
  : "";

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; frame-src 'self' https://vercel.live https://*.vercel.app${firebaseAuthFrameSrc} https://*.firebaseapp.com https://accounts.google.com https://*.google.com; img-src 'self' data: blob: https:; media-src 'self' https:; font-src 'self' data: https:; connect-src 'self' https: wss: https://*.sentry.io; style-src 'self' 'unsafe-inline' https:; script-src ${scriptSrc};${isDevelopment ? "" : " upgrade-insecure-requests;"}`,
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false,
  reactCompiler: true,
  output: "standalone", // Necessário para Firebase App Hosting
  // node:inspector é um built-in do Node.js — não precisa ser copiado para o standalone.
  // Sem isso, o tracer tenta copiar um chunk com ":" no nome, inválido no Windows.
  outputFileTracingExcludes: {
    "*": ["**/*inspector*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
});
