// Response headers for every page (next.config.ts). The CSP is nonce-free on purpose: nonces force
// every page to render per request, and the storefront relies on static and partial prerendering.
// Next's own inline bootstrap scripts therefore need 'unsafe-inline'; everything else stays tight.

export interface Header {
  key: string;
  value: string;
}

export function securityHeaders({ dev, https }: { dev: boolean; https: boolean }): Header[] {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Product photos come straight from the image CDNs (see image-loader.ts).
    "img-src 'self' data: blob: https://images.unsplash.com https://res.cloudinary.com",
    "media-src 'self'",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
  ];
}
