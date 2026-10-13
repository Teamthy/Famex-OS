export const ROLES = {
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
  BURSAR: "Bursar",
  HOD: "HOD",
  COORDINATOR: "Academic Coordinator",
};

export const PERMISSIONS: Record<string, string[]> = {
  [ROLES.ADMIN]: ["*"],
  [ROLES.TEACHER]: ["attendance:mark", "gradebook:write", "exams:create", "assignments:create"],
  [ROLES.STUDENT]: ["grades:read", "attendance:read", "report-cards:read", "exams:take"],
  [ROLES.PARENT]: ["grades:read", "attendance:read", "report-cards:read", "fees:view", "fees:pay"],
  [ROLES.BURSAR]: ["fees:write", "invoices:generate", "payments:record"],
  [ROLES.HOD]: ["gradebook:approve", "exams:approve", "questions:approve", "lesson-plans:approve"],
};

export function hasPermission(role: string, action: string): boolean {
  const perms = PERMISSIONS[role] || [];
  return perms.includes("*") || perms.includes(action);
}
