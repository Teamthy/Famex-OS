-- Whether a paper permits the on-screen calculator.
--
-- Defaults to false: every existing paper keeps the behaviour it had (no
-- calculator), and a teacher opts in per paper. Adding it with a default of true
-- would have silently granted a calculator on papers whose instructions say
-- otherwise.
ALTER TABLE "Exam" ADD COLUMN "allowCalculator" BOOLEAN NOT NULL DEFAULT false;
