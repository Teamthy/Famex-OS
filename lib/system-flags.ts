import { prisma } from "@/lib/prisma";

export type SystemFlags = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

const DEFAULT_FLAGS: SystemFlags = {
  maintenanceMode: false,
  maintenanceMessage:
    "Ykay EduPortal is undergoing scheduled maintenance. Please try again shortly.",
  updatedAt: null,
  updatedByUserId: null,
};

const SINGLETON_ID = "singleton";

/**
 * Read platform flags from the DB (singleton row). Returns defaults if the row
 * does not yet exist or the DB is unreachable. Persisting in the DB — instead of
 * the local filesystem — keeps maintenance mode working on serverless deploys
 * (Vercel's filesystem is read-only outside /tmp) and consistent across instances.
 */
export async function readSystemFlags(): Promise<SystemFlags> {
  try {
    const row = await prisma.systemFlags.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) return { ...DEFAULT_FLAGS };
    return {
      maintenanceMode: row.maintenanceMode,
      maintenanceMessage: row.maintenanceMessage,
      updatedAt: row.updatedAt.toISOString(),
      updatedByUserId: row.updatedByUserId,
    };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

export async function writeSystemFlags(
  next: Partial<SystemFlags>,
  actorUserId?: string | null,
): Promise<SystemFlags> {
  const row = await prisma.systemFlags.upsert({
    where: { id: SINGLETON_ID },
    update: {
      ...(next.maintenanceMode !== undefined ? { maintenanceMode: next.maintenanceMode } : {}),
      ...(next.maintenanceMessage !== undefined
        ? { maintenanceMessage: next.maintenanceMessage }
        : {}),
      updatedByUserId: actorUserId ?? null,
    },
    create: {
      id: SINGLETON_ID,
      maintenanceMode: next.maintenanceMode ?? DEFAULT_FLAGS.maintenanceMode,
      maintenanceMessage: next.maintenanceMessage ?? DEFAULT_FLAGS.maintenanceMessage,
      updatedByUserId: actorUserId ?? null,
    },
  });
  return {
    maintenanceMode: row.maintenanceMode,
    maintenanceMessage: row.maintenanceMessage,
    updatedAt: row.updatedAt.toISOString(),
    updatedByUserId: row.updatedByUserId,
  };
}

/** Env + runtime flags for super-admin system panel (never exposes secret values). */
export function readPublicSystemConfig() {
  const present = (key: string) => Boolean(process.env[key] && String(process.env[key]).trim());
  return {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL || null,
    nodeEnv: process.env.NODE_ENV || null,
    schoolTimezone: process.env.SCHOOL_TIMEZONE || "Africa/Lagos",
    staffLateCutoff: process.env.STAFF_LATE_CUTOFF || "08:00",
    showDemoBadge: process.env.NEXT_PUBLIC_SHOW_DEMO_BADGE === "true",
    configured: {
      database: present("DATABASE_URL"),
      authSecret: present("AUTH_SECRET"),
      paystackPublic: present("PAYSTACK_PUBLIC_KEY"),
      paystackSecret: present("PAYSTACK_SECRET_KEY"),
      resend: present("RESEND_API_KEY"),
      upstash: present("UPSTASH_REDIS_REST_URL") && present("UPSTASH_REDIS_REST_TOKEN"),
      s3: present("S3_BUCKET") && present("S3_ACCESS_KEY_ID"),
      jobsSecret: present("JOBS_SECRET"),
    },
  };
}
