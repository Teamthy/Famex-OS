import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getQueuedWrites: vi.fn(),
  removeQueuedWrite: vi.fn(),
  incrementRetry: vi.fn(),
  getQueueCount: vi.fn(),
  listPendingSubmissions: vi.fn(),
  patchSubmission: vi.fn(),
  pendingSubmissionCount: vi.fn(),
  removeSubmission: vi.fn(),
}));

vi.mock("@/lib/offline/db", () => mocks);
vi.mock("@/lib/offline/exam-store", () => mocks);

import { flushExamSubmissions, flushQueue, onQueueWriteResult } from "@/lib/offline/sync";
import type { QueuedWrite } from "@/lib/offline/db";

const write: QueuedWrite = {
  id: 1,
  url: "/api/teacher/gradebook",
  method: "POST",
  body: { assignmentId: "assignment_1", action: "SAVE", scores: [] },
  queuedAt: Date.now(),
  retries: 0,
};

describe("offline queue write feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getQueuedWrites.mockResolvedValue([write]);
    mocks.getQueueCount.mockResolvedValue(0);
    mocks.removeQueuedWrite.mockResolvedValue(undefined);
    mocks.incrementRetry.mockResolvedValue(undefined);
    mocks.listPendingSubmissions.mockResolvedValue([]);
    mocks.patchSubmission.mockResolvedValue(undefined);
    mocks.pendingSubmissionCount.mockResolvedValue(0);
    mocks.removeSubmission.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("reports a queue write only after the server confirms success", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    const listener = vi.fn();
    const unsubscribe = onQueueWriteResult(listener);

    await expect(flushQueue()).resolves.toEqual({ succeeded: 1, failed: 0 });

    expect(listener).toHaveBeenCalledWith({
      write,
      success: true,
      statusCode: 200,
      willRetry: false,
    });
    unsubscribe();
  });

  it("reports a rejected queued mutation so its screen can show a contextual error", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 409 }));
    const listener = vi.fn();
    const unsubscribe = onQueueWriteResult(listener);

    await expect(flushQueue()).resolves.toEqual({ succeeded: 0, failed: 1 });

    expect(listener).toHaveBeenCalledWith({
      write,
      success: false,
      statusCode: 409,
      willRetry: false,
    });
    expect(mocks.removeQueuedWrite).toHaveBeenCalledWith(write.id);
    unsubscribe();
  });

  it("shares one in-flight exam replay across simultaneous reconnect triggers", async () => {
    const submission = {
      id: "attempt-client-id",
      examId: "exam_1",
      title: "Paper",
      subjectName: "Mathematics",
      clientAttemptId: "attempt-client-id",
      answers: [{ questionId: "question_1", response: "A" }],
      startedAt: new Date(0).toISOString(),
      submittedAt: new Date(60_000).toISOString(),
      durationMinutes: 10,
      manifest: {
        examId: "exam_1",
        packetId: "packet_1",
        fingerprint: "fingerprint",
        questionCount: 1,
        totalMarks: 1,
        durationMinutes: 10,
        sessionLabel: null,
        termIndex: null,
        downloadedAt: new Date(0).toISOString(),
      },
      signature: "signature",
      serverAttemptId: "server-attempt-1",
      status: "PENDING" as const,
      lastError: null,
      attempts: 0,
      queuedAt: new Date(60_000).toISOString(),
    };
    mocks.listPendingSubmissions.mockResolvedValue([submission]);
    let resolveResponse: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        }),
    );

    const first = flushExamSubmissions();
    const second = flushExamSubmissions();
    await vi.waitFor(() => expect(resolveResponse).toBeTypeOf("function"));
    resolveResponse?.(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(Promise.all([first, second])).resolves.toEqual([
      { sent: 1, pending: 0, failed: 0 },
      { sent: 1, pending: 0, failed: 0 },
    ]);
    expect(mocks.listPendingSubmissions).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.removeSubmission).toHaveBeenCalledWith(submission.id);
  });
});
