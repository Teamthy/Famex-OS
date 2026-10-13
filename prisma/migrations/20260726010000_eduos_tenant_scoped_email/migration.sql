-- EDUos: make User.email tenant-scoped (composite unique [schoolId, email])
-- so the same email can exist in different schools.

-- DropIndex
DROP INDEX "User_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolId_email_key" ON "User"("schoolId", "email");
