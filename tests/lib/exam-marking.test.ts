import { ExamAttemptStatus, ExamQuestionType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { essayMarkingRefusal } from "@/lib/exam-marking";

describe("essayMarkingRefusal", () => {
  const submittedEssay = {
    questionType: ExamQuestionType.ESSAY,
    attemptStatus: ExamAttemptStatus.SUBMITTED,
    resultAdoptedAt: null,
    examResultsReleased: false,
  };

  it("allows an unadopted submitted essay to be marked", () => {
    expect(essayMarkingRefusal(submittedEssay)).toBeNull();
  });

  it("prevents teachers from marking while an attempt is still in progress", () => {
    expect(
      essayMarkingRefusal({ ...submittedEssay, attemptStatus: ExamAttemptStatus.IN_PROGRESS }),
    ).toMatchObject({ code: "ATTEMPT_IN_PROGRESS" });
  });

  it("prevents a compiled result from being changed outside corrections", () => {
    expect(essayMarkingRefusal({ ...submittedEssay, resultAdoptedAt: new Date() })).toMatchObject({
      code: "RESULTS_LOCKED",
    });
  });

  it("prevents a released exam score from being changed", () => {
    expect(essayMarkingRefusal({ ...submittedEssay, examResultsReleased: true })).toMatchObject({
      code: "RESULTS_LOCKED",
    });
  });

  it("allows fill-in-the-blank items that are explicitly marked by a teacher", () => {
    expect(
      essayMarkingRefusal({ ...submittedEssay, questionType: ExamQuestionType.FILL_BLANK }),
    ).toBeNull();
  });

  it("refuses manual marks for automatically graded items", () => {
    expect(
      essayMarkingRefusal({ ...submittedEssay, questionType: ExamQuestionType.MCQ }),
    ).toMatchObject({ code: "NOT_MANUAL_MARK" });
  });
});
