export type GradebookMutationAction = "SAVE" | "SUBMIT";

/** Only draft saves may be queued, and newer saves stay behind older queued work. */
export function shouldQueueGradebookMutation(input: {
  action: GradebookMutationAction;
  online: boolean;
  hasPendingSave: boolean;
}): boolean {
  return input.action === "SAVE" && (!input.online || input.hasPendingSave);
}

/** Final submission is online-only and cannot overtake a queued draft save. */
export function canSubmitGradebook(input: { online: boolean; hasPendingSave: boolean }): boolean {
  return input.online && !input.hasPendingSave;
}
