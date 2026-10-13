/**
 * Content-Security-Policy for every page and API response.
 *
 * It is built per request (see middleware.ts) rather than in next.config.ts. The
 * storage origin depends on runtime settings, and next.config headers are fixed
 * when the app is built. The production image is built without S3 settings, so a
 * build-time value would be missing there.
 */

export type CspOptions = {
  isProduction: boolean;
  /** Plausible analytics is on, so its script and event endpoint are allowed. */
  plausible: boolean;
  /** Origin the browser uploads admission documents to. See storageUploadOrigin. */
  storageOrigin: string | null;
};

export function buildContentSecurityPolicy({
  isProduction,
  plausible,
  storageOrigin,
}: CspOptions): string {
  const plausibleOrigin = plausible ? " https://plausible.io" : "";
  const storage = storageOrigin ? ` ${storageOrigin}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}${plausibleOrigin}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://api.paystack.co https://*.upstash.io https://*.neon.tech${plausibleOrigin}${storage}`,
    // frame-ancestors blocks this site from being embedded anywhere
    // (same goal as X-Frame-Options, understood by modern browsers).
    "frame-ancestors 'none'",
    // frame-src: Paystack checkout + the Google Maps embed on the home page (Find Us).
    "frame-src 'self' https://checkout.paystack.com https://www.google.com https://maps.google.com https://*.gstatic.com",
  ].join("; ");
}

/**
 * The single origin the browser PUTs admission documents to, worked out from the same
 * settings lib/storage.ts uses. The presigned URL is always on this origin, so allowing
 * exactly this origin (not a wildcard) lets the upload through and nothing else.
 * Returns null when storage is not configured, because no upload can happen then.
 */
export function storageUploadOrigin(env: Record<string, string | undefined>): string | null {
  const bucket = env.S3_BUCKET?.trim();
  if (!bucket || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) return null;

  const region = env.S3_REGION || "us-east-1";
  const forcePathStyle = env.S3_FORCE_PATH_STYLE === "true";
  const endpoint = env.S3_ENDPOINT?.trim();

  if (endpoint) {
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch {
      return null;
    }
    // Path style puts the bucket in the path; virtual-hosted style puts it in the host.
    return forcePathStyle ? url.origin : `${url.protocol}//${bucket}.${url.host}`;
  }
  return forcePathStyle
    ? `https://s3.${region}.amazonaws.com`
    : `https://${bucket}.s3.${region}.amazonaws.com`;
}
