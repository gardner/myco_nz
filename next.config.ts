import type { NextConfig } from "next";

const imageSources = [
  "https://inaturalist-open-data.s3.amazonaws.com",
  "https://static.inaturalist.org",
];

const contentSecurityPolicyDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self'",
  `img-src 'self' data: ${imageSources.join(" ")}`,
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
  "form-action 'self'",
];

export function getContentSecurityPolicy(isProduction: boolean): string {
  return [
    ...contentSecurityPolicyDirectives,
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

const contentSecurityPolicy = getContentSecurityPolicy(
  process.env.NODE_ENV === "production",
);

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Permissions-Policy", value: "geolocation=(self)" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
