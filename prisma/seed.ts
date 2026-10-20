/**
 * Initial-admin seed — provisions (or resets) the first ADMIN for this install.
 *
 * Run locally:  npm run db:seed-admin
 * Run in the production image (no tsx there — the Dockerfile bundles this file
 * to prisma/seed-admin.mjs, exactly like the CBT boot seed):
 *
 *   docker compose exec app node prisma/seed-admin.mjs
 *
 * Deliberately NOT run from docker-entrypoint.sh: this upsert resets the
 * admin password on every run, so auto-running it at boot would turn the
 * INITIAL_ADMIN_PASSWORD env var into a permanent backdoor. Run it once,
 * by hand, then remove INITIAL_ADMIN_PASSWORD from the environment.
 *
 * ── Why this file does not import getSchool() ───────────────────────────────
 * It used to import getSchool() from lib/school and the singleton from
 * lib/prisma. lib/school imports next/headers, which only exists inside a
 * Next.js request context — so the bundled .mjs would drag in (and trip over)
 * the framework when run as a plain node script in the slim runner image.
 * Instead it shares the School create-defaults from lib/school-defaults.ts,
 * the dependency-free module getSchool() also uses, so both create the row
 * identically (same slug, same SCHOOL_* fallbacks, same customDomain sync).
 */
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { schoolCreateDefaultsFromEnv, schoolSlugFromEnv } from "../lib/school-defaults";

const prisma = new PrismaClient();

/** The getSchool() upsert from lib/school.ts, via the shared defaults. */
async function ensureSchool() {
  const create = schoolCreateDefaultsFromEnv();
  const { customDomain } = create;

  return prisma.school.upsert({
    where: { slug: schoolSlugFromEnv() },
    update: {
      ...(customDomain ? { customDomain } : {}),
    },
    create,
  });
}

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || "Ykay College Administrator";
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set INITIAL_ADMIN_EMAIL and an INITIAL_ADMIN_PASSWORD of at least 12 characters in .env before seeding.",
    );
  const school = await ensureSchool();
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email } },
    update: {
      name,
      role: UserRole.ADMIN,
      schoolId: school.id,
      passwordHash,
      isActive: true,
      isSuspended: false,
    },
    create: { email, name, role: UserRole.ADMIN, schoolId: school.id, passwordHash },
  });
  console.log(`Initial admin is ready: ${email}`);
}
main().finally(() => prisma.$disconnect());
