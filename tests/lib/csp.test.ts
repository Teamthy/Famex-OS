import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, storageUploadOrigin } from "@/lib/csp";

function connectSrc(policy: string) {
  return policy.split("; ").find((directive) => directive.startsWith("connect-src")) ?? "";
}

describe("buildContentSecurityPolicy", () => {
  it("allows the exact storage origin for uploads, and no wildcard storage host", () => {
    const origin = "https://ykay-docs.s3.eu-west-2.amazonaws.com";
    const policy = buildContentSecurityPolicy({
      isProduction: true,
      plausible: false,
      storageOrigin: origin,
    });
    expect(connectSrc(policy)).toContain(` ${origin}`);
    expect(policy).not.toMatch(/https:\/\/\*\.amazonaws\.com/);
  });

  it("leaves storage out of connect-src when no storage is configured", () => {
    const policy = buildContentSecurityPolicy({
      isProduction: true,
      plausible: false,
      storageOrigin: null,
    });
    expect(policy).not.toContain("amazonaws");
    expect(connectSrc(policy)).toBe(
      "connect-src 'self' https://api.paystack.co https://*.upstash.io https://*.neon.tech",
    );
  });

  it("keeps the existing directives that the app depends on", () => {
    const policy = buildContentSecurityPolicy({
      isProduction: true,
      plausible: false,
      storageOrigin: null,
    });
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("https://checkout.paystack.com");
    expect(policy).toContain("https://maps.google.com");
  });

  it("allows eval only outside production, and Plausible only when enabled", () => {
    const dev = buildContentSecurityPolicy({
      isProduction: false,
      plausible: false,
      storageOrigin: null,
    });
    const prod = buildContentSecurityPolicy({
      isProduction: true,
      plausible: true,
      storageOrigin: null,
    });
    expect(dev).toContain("'unsafe-eval'");
    expect(prod).not.toContain("'unsafe-eval'");
    expect(prod).toContain("https://plausible.io");
    expect(connectSrc(prod)).toContain("https://plausible.io");
  });
});

describe("storageUploadOrigin", () => {
  const credentials = {
    S3_ACCESS_KEY_ID: "AKIAEXAMPLE",
    S3_SECRET_ACCESS_KEY: "secret-example-value",
  };

  // The origin must be the host the SDK really signs for. Check each configuration against the SDK.
  const cases: Array<{
    name: string;
    env: Record<string, string>;
    region: string;
    endpoint?: string;
    pathStyle?: boolean;
  }> = [
    {
      name: "AWS virtual-hosted",
      env: { S3_BUCKET: "ykay-docs", S3_REGION: "eu-west-2" },
      region: "eu-west-2",
    },
    { name: "AWS us-east-1 default", env: { S3_BUCKET: "ykay-docs" }, region: "us-east-1" },
    {
      name: "AWS path-style",
      env: { S3_BUCKET: "ykay-docs", S3_REGION: "eu-west-2", S3_FORCE_PATH_STYLE: "true" },
      region: "eu-west-2",
      pathStyle: true,
    },
    {
      name: "custom endpoint, virtual-hosted (R2-style)",
      env: {
        S3_BUCKET: "ykay-docs",
        S3_REGION: "auto",
        S3_ENDPOINT: "https://acc123.r2.cloudflarestorage.com",
      },
      region: "auto",
      endpoint: "https://acc123.r2.cloudflarestorage.com",
    },
    {
      name: "custom endpoint, path-style (MinIO-style)",
      env: {
        S3_BUCKET: "ykay-docs",
        S3_REGION: "us-east-1",
        S3_ENDPOINT: "http://127.0.0.1:9000",
        S3_FORCE_PATH_STYLE: "true",
      },
      region: "us-east-1",
      endpoint: "http://127.0.0.1:9000",
      pathStyle: true,
    },
  ];

  for (const testCase of cases) {
    it(`matches the host the SDK signs for: ${testCase.name}`, async () => {
      const env: Record<string, string> = { ...testCase.env, ...credentials };
      const client = new S3Client({
        region: testCase.region,
        endpoint: testCase.endpoint,
        forcePathStyle: Boolean(testCase.pathStyle),
        credentials: {
          accessKeyId: credentials.S3_ACCESS_KEY_ID,
          secretAccessKey: credentials.S3_SECRET_ACCESS_KEY,
        },
      });
      const signed = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: env.S3_BUCKET ?? "",
          Key: "admissions/app/birth-certificate.pdf",
        }),
        { expiresIn: 600 },
      );
      expect(storageUploadOrigin(env)).toBe(new URL(signed).origin);
    });
  }

  it("returns null when credentials or the bucket are missing, or the endpoint is not a URL", () => {
    expect(storageUploadOrigin({ S3_BUCKET: "ykay-docs" })).toBeNull();
    expect(storageUploadOrigin({ ...credentials })).toBeNull();
    expect(
      storageUploadOrigin({ ...credentials, S3_BUCKET: "b", S3_ENDPOINT: "not a url" }),
    ).toBeNull();
  });
});
