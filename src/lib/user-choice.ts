let chosen = false;

/** Whether the startup choice of user was already made (or skipped) since this window started. */
export function userChoiceDone(): boolean {
  return chosen;
}

/** Records that the startup choice of user is done: it is asked once per launch. */
export function markUserChoiceDone(): void {
  chosen = true;
}
