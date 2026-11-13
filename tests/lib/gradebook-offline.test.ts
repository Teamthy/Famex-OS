import { describe, expect, it } from "vitest";
import { canSubmitGradebook, shouldQueueGradebookMutation } from "@/lib/offline/gradebook";

describe("offline gradebook mutations", () => {
  it("queues offline draft saves", () => {
    expect(
      shouldQueueGradebookMutation({ action: "SAVE", online: false, hasPendingSave: false }),
    ).toBe(true);
  });

  it("never queues final submission", () => {
    expect(
      shouldQueueGradebookMutation({ action: "SUBMIT", online: false, hasPendingSave: false }),
    ).toBe(false);
    expect(
      shouldQueueGradebookMutation({ action: "SUBMIT", online: true, hasPendingSave: true }),
    ).toBe(false);
  });

  it("keeps new saves behind a previously queued save", () => {
    expect(
      shouldQueueGradebookMutation({ action: "SAVE", online: true, hasPendingSave: true }),
    ).toBe(true);
    expect(
      shouldQueueGradebookMutation({ action: "SAVE", online: true, hasPendingSave: false }),
    ).toBe(false);
  });

  it("allows final submission only online and with no pending draft", () => {
    expect(canSubmitGradebook({ online: true, hasPendingSave: false })).toBe(true);
    expect(canSubmitGradebook({ online: false, hasPendingSave: false })).toBe(false);
    expect(canSubmitGradebook({ online: true, hasPendingSave: true })).toBe(false);
  });
});
