import { ExamAttemptStatus, ExamQuestionType } from "@prisma/client";

export type EssayMarkingRefusal = { code: string; message: string };

/** Guard server-side essay marking against premature or already-adopted scores. */
export function essayMarkingRefusal(params: {
  questionType: ExamQuestionType;
  attemptStatus: ExamAttemptStatus;
  resultAdoptedAt: Date | null;
  examResultsReleased: boolean;
}): EssayMarkingRefusal | null {
  if (
    params.questionType !== ExamQuestionType.ESSAY &&
    params.questionType !== ExamQuestionType.FILL_BLANK
  ) {
    return {
      code: "NOT_MANUAL_MARK",
      message: "Only essay and fill-in-the-blank answers can be marked manually.",
    };
  }

  if (params.attemptStatus === ExamAttemptStatus.IN_PROGRESS) {
    return { code: "ATTEMPT_IN_PROGRESS", message: "This attempt has not been submitted yet." };
  }

  if (params.resultAdoptedAt || params.examResultsReleased) {
    return {
      code: "RESULTS_LOCKED",
      message: "This score is already compiled or released and can no longer be changed here.",
    };
  }

  return null;
}
