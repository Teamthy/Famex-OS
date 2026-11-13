import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getQueuedWrites: vi.fn(),
  removeQueuedWrite: vi.fn(),
  incrementRetry: vi.fn(),
  getQueueCount: vi.fn(),
}));

vi.mock("@/lib/offline/db", () => mocks);
vi.mock("@/lib/offline/exam-store", () => ({
  listPendingSubmissions: vi.fn(),
  patchSubmission: vi.fn(),
  pendingSubmissionCount: vi.fn(),
  removeSubmission: vi.fn(),
}));

import { flushQueue, onQueueWriteResult } from "@/lib/offline/sync";
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
});
