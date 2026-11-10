import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PEOPLE_ADMIN_ROLE_NAMES } from "@/lib/roles";

/** B-06: names live in lib/roles.ts; this is their Prisma-typed form. */
export const PEOPLE_ADMIN_ROLES = PEOPLE_ADMIN_ROLE_NAMES.map((role) => UserRole[role]);
/**
 * B-06: every role the provisioning flow may create. Previously six — a
 * proprietor, principal, vice principal, librarian or nurse could not be
 * created at all, which is why those accounts either did not exist or were
 * hand-sql'd. The prisma-free names live in lib/roles.ts
 * (PROVISIONABLE_STAFF_ROLES); tests/lib/rbac-entitlements.test.ts asserts
 * this Prisma-typed tuple and that list stay exactly in step, and the staff
 * screen's <select> reads the prisma-free one so the client bundle stays
 * Prisma-free.
 */
export const STAFF_ROLES = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.BURSAR,
  UserRole.COORDINATOR,
  UserRole.HOD,
  UserRole.TEACHER,
  UserRole.PROPRIETOR,
  UserRole.PRINCIPAL,
  UserRole.VICE_PRINCIPAL,
  UserRole.LIBRARIAN,
  UserRole.NURSE,
] as const;

export const hashValue = (value: string) => createHash("sha256").update(value).digest("hex");
export const oneTimeSecret = () => randomBytes(18).toString("base64url");
export const studentNumber = () =>
  `YKC/${new Date().getFullYear()}/${randomBytes(4).toString("hex").toUpperCase()}`;

export async function uniqueStudentNumber(schoolId: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const value = studentNumber();
    const found = await prisma.studentProfile.findUnique({
      where: { schoolId_studentId: { schoolId, studentId: value } },
      select: { id: true },
    });
    if (!found) return value;
  }
  throw new Error("Could not allocate a student number. Please try again.");
}

export async function passwordHash(password: string) {
  return bcrypt.hash(password, 12);
}
