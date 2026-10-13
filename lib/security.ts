import { createHash, randomBytes } from "crypto";

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createApplicationId() {
  const year = new Date().getFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  return `YKCAPP${year}${suffix}`;
}

export function safeFileName(fileName: string) {
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() : "";
  return extension?.replace(/[^a-z0-9]/g, "") || "bin";
}
