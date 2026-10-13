import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const PEOPLE_ADMIN_ROLES = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.COORDINATOR,
  UserRole.SUPER_ADMIN,
];
export const STAFF_ROLES = [
  UserRole.ADMIN,
  UserRole.DIRECTOR,
  UserRole.BURSAR,
  UserRole.COORDINATOR,
  UserRole.HOD,
  UserRole.TEACHER,
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
