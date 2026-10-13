import bcrypt from "bcryptjs";
import crypto from "crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getSchool } from "../lib/school";
import { logger } from "@/lib/logger";

async function main() {
  const school = await getSchool();
  const email = (process.env.SUPER_ADMIN_EMAIL || "developer@ykaycollege.com").toLowerCase();
  const provided = process.env.SUPER_ADMIN_PASSWORD?.trim();
  const password = provided || `Dev-${crypto.randomBytes(9).toString("base64url")}`;
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findFirst({ where: { email, schoolId: school.id } });
  await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email } },
    update: {
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      isSuspended: false,
      ...(provided || !existing ? { passwordHash } : {}),
    },
    create: {
      schoolId: school.id,
      email,
      name: process.env.SUPER_ADMIN_NAME || "Platform Developer",
      role: UserRole.SUPER_ADMIN,
      passwordHash,
    },
  });

  console.log("Super admin ready:");
  console.log(`  Email:    ${email}`);
  if (provided) {
    console.log("  Password: (from SUPER_ADMIN_PASSWORD env var)");
  } else if (!existing) {
    console.log(`  Password: ${password}   <-- shown once, store it securely`);
  } else {
    console.log("  Password: unchanged (set SUPER_ADMIN_PASSWORD to rotate)");
  }
  console.log("  Console:  /super-admin (sign in via /login)");
}

main()
  .catch((error) => {
    logger.error("Request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
