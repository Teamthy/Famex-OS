const { getDefaultConfig } = require("expo/metro-config");

/**
 * Metro config with a dev-only API proxy.
 *
 * ── The problem ────────────────────────────────────────────────────────────
 * Running the app as a web build (`npm run web`) puts it on an origin like
 * http://localhost:8081. The deployed API answers every preflight with
 *
 *     access-control-allow-origin: https://ykaycollege.edu.ng
 *
 * because that is NEXT_PUBLIC_SITE_URL. The browser therefore blocks the
 * response before any application code runs, and reports the unhelpful
 * "TypeError: Failed to fetch" — which looks like the login is broken when
 * the API is in fact answering a perfectly clean 401.
 *
 * ── Why a proxy rather than an env var ─────────────────────────────────────
 * Pointing EXPO_PUBLIC_API_URL at the deployed API does not help: the origin
 * is still :8081, so CORS still rejects it. Pointing it at localhost:3000
 * only works if you happen to be running the Next dev server too.
 *
 * Proxying sidesteps CORS entirely. The browser calls /api/... on Metro's own
 * origin — same-origin, so no preflight, no Access-Control headers needed —
 * and Metro forwards it server-side, where CORS does not apply at all.
 *
 * ── Scope ──────────────────────────────────────────────────────────────────
 * Dev server only. `expo export` and every EAS build ignore this file's
 * middleware, and those builds are native, where CORS is irrelevant. Nothing
 * here reaches production.
 *
 * Set EXPO_PUBLIC_API_URL=/ so the app issues relative /api/... requests.
 */

const config = getDefaultConfig(__dirname);

const API_TARGET = process.env.DEV_API_PROXY_TARGET || "https://ykay-eduport2.vercel.app";

const originalEnhance = config.server?.enhanceMiddleware;

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const base = originalEnhance ? originalEnhance(middleware, server) : middleware;

    return (req, res, next) => {
      if (!req.url || !req.url.startsWith("/api/")) return base(req, res, next);

      const target = new URL(req.url, API_TARGET);
      const isHttps = target.protocol === "https:";
      const transport = isHttps ? require("node:https") : require("node:http");

      // Forward the body for POST/PATCH/PUT.
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = Buffer.concat(chunks);

        const headers = { ...req.headers };
        // The upstream must see ITS OWN host, or Vercel routes to the wrong
        // project and the cookie domain will not match.
        headers.host = target.host;
        // Drop the browser's origin/referer: we are now a server-side caller,
        // and leaving them on makes the upstream apply CORS rules that are
        // irrelevant here.
        delete headers.origin;
        delete headers.referer;
        delete headers["accept-encoding"];
        if (body.length) headers["content-length"] = String(body.length);

        const upstream = transport.request(
          { hostname: target.hostname, port: target.port || (isHttps ? 443 : 80), path: target.pathname + target.search, method: req.method, headers },
          (upstreamRes) => {
            const outHeaders = { ...upstreamRes.headers };
            // Rewrite Set-Cookie so the session cookie is accepted on the
            // dev origin: Domain must go, and Secure would block it on http.
            const cookies = upstreamRes.headers["set-cookie"];
            if (cookies) {
              outHeaders["set-cookie"] = cookies.map((cookie) =>
                cookie
                  .replace(/;\s*Domain=[^;]+/i, "")
                  .replace(/;\s*Secure/i, "")
                  .replace(/;\s*SameSite=None/i, "; SameSite=Lax"),
              );
            }
            res.writeHead(upstreamRes.statusCode || 502, outHeaders);
            upstreamRes.pipe(res);
          },
        );

        upstream.on("error", (error) => {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Dev proxy could not reach ${API_TARGET}: ${error.message}` }));
        });

        if (body.length) upstream.write(body);
        upstream.end();
      });
    };
  },
};

module.exports = config;
