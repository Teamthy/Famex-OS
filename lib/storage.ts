import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AdmissionDocumentType } from "@/lib/admissions";
import { safeFileName } from "@/lib/security";

/**
 * Thrown when the S3 settings are missing. That is an operator problem, not something
 * the family did, so routes map it to a 503 with a clear message instead of a 500.
 */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "Secure document storage is not configured (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY).",
    );
    this.name = "StorageNotConfiguredError";
  }
}

function getStorageConfig() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION || "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new StorageNotConfiguredError();
  }

  return {
    bucket,
    region,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    accessKeyId,
    secretAccessKey,
  };
}

function getClient() {
  const config = getStorageConfig();
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function createDocumentStorageKey(
  applicationId: string,
  documentType: AdmissionDocumentType,
  fileName: string,
) {
  const prefix = (process.env.S3_ADMISSIONS_PREFIX || "admissions").replace(/^\/+|\/+$/g, "");
  return `${prefix}/${applicationId}/${documentType.toLowerCase()}-${crypto.randomUUID()}.${safeFileName(fileName)}`;
}

export async function createSecureUploadUrl(input: {
  applicationId: string;
  documentType: AdmissionDocumentType;
  fileName: string;
  contentType: string;
}) {
  const config = getStorageConfig();
  const storageKey = createDocumentStorageKey(
    input.applicationId,
    input.documentType,
    input.fileName,
  );
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: storageKey,
    ContentType: input.contentType,
    Metadata: {
      applicationId: input.applicationId,
      documentType: input.documentType,
    },
  });

  return {
    storageKey,
    uploadUrl: await getSignedUrl(getClient(), command, { expiresIn: 10 * 60 }),
  };
}

export async function verifyStoredDocument(storageKey: string, expectedSize: number) {
  const config = getStorageConfig();
  const result = await getClient().send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
    }),
  );

  return result.ContentLength === expectedSize;
}

/**
 * Reads a stored document's bytes for malware scanning (C-006). Admission
 * documents are identity paperwork (a few MB at most), so buffering in memory
 * is fine — anything larger than the cap refuses to scan rather than silently
 * streaming unbounded objects through the app.
 */
export async function getStoredDocumentBytes(
  storageKey: string,
  maxBytes = 25 * 1024 * 1024,
): Promise<Uint8Array> {
  const config = getStorageConfig();
  const result = await getClient().send(
    new GetObjectCommand({ Bucket: config.bucket, Key: storageKey }),
  );
  if (!result.Body) {
    throw new Error("Stored object has no body.");
  }
  const bytes = await result.Body.transformToByteArray();
  if (bytes.byteLength > maxBytes) {
    throw new Error(`Stored object exceeds the ${maxBytes}-byte scan limit.`);
  }
  return bytes;
}
