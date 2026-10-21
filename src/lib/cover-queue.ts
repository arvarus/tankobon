/**
 * A last-in-first-out queue with a concurrency limit, for the cover requests of the library page.
 * The rows that matter are the ones on screen now, so the newest request goes first, and a request that
 * hasn't started when its row leaves the screen is cancelled instead of reaching the decoder, whose
 * thumbnail queue can't be cancelled (every cover it is asked for opens an archive).
 * @module
 */

/** Runs the queued tasks, at most `concurrency` at a time, newest first. */
export interface TaskQueue {
  /** Queues `task`; the returned function cancels it if it hasn't started (a no-op afterwards). */
  enqueue(task: () => Promise<unknown>): () => void;
}

/** A {@link TaskQueue} that runs `concurrency` tasks at a time. A task that rejects is ignored. */
export function createTaskQueue(concurrency: number): TaskQueue {
  const pending: (() => Promise<unknown>)[] = [];
  let running = 0;

  const next = (): void => {
    while (running < concurrency && pending.length > 0) {
      const task = pending.pop()!;
      running += 1;
      void task()
        .catch(() => undefined)
        .finally(() => {
          running -= 1;
          next();
        });
    }
  };

  return {
    enqueue(task) {
      pending.push(task);
      next();
      return () => {
        const index = pending.indexOf(task);
        if (index !== -1) pending.splice(index, 1);
      };
    },
  };
}
