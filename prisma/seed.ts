import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getSchool } from "../lib/school";

async function main() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || "Ykay College Administrator";
  if (!email || !password || password.length < 12)
    throw new Error(
      "Set INITIAL_ADMIN_EMAIL and an INITIAL_ADMIN_PASSWORD of at least 12 characters in .env before seeding.",
    );
  const school = await getSchool();
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
