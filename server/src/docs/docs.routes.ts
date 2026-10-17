import { Router } from "express";
import { buildOpenApi } from "./openapi";

// Scalar's standalone reference, pinned with Subresource Integrity so the CDN can't change it under us.
const SCALAR_SRC = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.3/dist/browser/standalone.js";
const SCALAR_SRI = "sha384-HWi/QCSPi64AQ0xBXFGDk+7gmvZ4hJ/7sZMIXqWVz6Ikb6+Cxej/hWKaomOStyFb";

// The page needs the CDN script and its inline styles; the rest of the API keeps helmet's strict policy.
const DOCS_CSP = [
  "default-src 'self'",
  "script-src https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.scalar.com",
  "font-src 'self' data: https://cdn.jsdelivr.net https://fonts.scalar.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>NESTAMA API reference</title>
  </head>
  <body>
    <script id="api-reference" data-url="/api/docs/openapi.json"></script>
    <script src="${SCALAR_SRC}" integrity="${SCALAR_SRI}" crossorigin="anonymous"></script>
  </body>
</html>
`;

export const docsRouter = Router();

// Built once: the document only changes when the code does.
let spec: object | undefined;

docsRouter.get("/openapi.json", (_req, res) => {
  spec ??= buildOpenApi();
  res.json(spec);
});

docsRouter.get("/", (_req, res) => {
  res.setHeader("Content-Security-Policy", DOCS_CSP);
  res.type("html").send(PAGE);
});
