-- Public report verification keyed on a guessable identifier.
--
-- /verify/report/<reportNumber> exposed a child's name, school ID, class and
-- grades to anyone who could guess the number. reportNumber is
-- RC/{year}/T{term}/{studentId} — the student id is printed on ID cards and
-- known to classmates, so enumeration was trivial.
--
-- Cards now carry a high-entropy verificationCode, and that is what the QR code
-- and the public URL use. The reportNumber stays for humans reading the paper.
-- NULL is allowed so cards issued before this migration keep verifying by
-- reportNumber; the backfill below gives them a code as well.

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN "verificationCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ReportCard_verificationCode_key" ON "ReportCard"("verificationCode");

-- Backfill, so the public page can stop accepting report numbers entirely.
-- gen_random_uuid() ships with PostgreSQL 13+.
UPDATE "ReportCard"
SET "verificationCode" = 'rc_' || replace(gen_random_uuid()::text, '-', '')
WHERE "verificationCode" IS NULL;
