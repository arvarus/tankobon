import { describe, expect, it } from 'vitest';

import { createTaskQueue } from './cover-queue';

/** A task that records its start and ends when `finish()` is called. */
function controllable(log: string[], name: string) {
  let finish: () => void = () => undefined;
  const task = () =>
    new Promise<void>((resolve) => {
      log.push(name);
      finish = resolve;
    });
  return { task, finish: () => finish() };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createTaskQueue', () => {
  it('runs at most `concurrency` tasks at a time', async () => {
    const log: string[] = [];
    const queue = createTaskQueue(2);
    const [a, b, c] = ['a', 'b', 'c'].map((name) => controllable(log, name));
    queue.enqueue(a.task);
    queue.enqueue(b.task);
    queue.enqueue(c.task);
    expect(log).toEqual(['a', 'b']);

    a.finish();
    await tick();
    expect(log).toEqual(['a', 'b', 'c']);
  });

  it('starts the newest waiting task first', async () => {
    const log: string[] = [];
    const queue = createTaskQueue(1);
    const [first, old, recent] = ['first', 'old', 'recent'].map((name) => controllable(log, name));
    queue.enqueue(first.task);
    queue.enqueue(old.task);
    queue.enqueue(recent.task);

    first.finish();
    await tick();
    expect(log).toEqual(['first', 'recent']);
  });

  it('never starts a task cancelled while it waited, and ignores a late cancel', async () => {
    const log: string[] = [];
    const queue = createTaskQueue(1);
    const [first, skipped, kept] = ['first', 'skipped', 'kept'].map((name) => controllable(log, name));
    const cancelFirst = queue.enqueue(first.task);
    const cancelSkipped = queue.enqueue(skipped.task);
    queue.enqueue(kept.task);

    cancelSkipped();
    cancelFirst(); // already running: nothing to cancel
    first.finish();
    await tick();
    kept.finish();
    await tick();
    expect(log).toEqual(['first', 'kept']);
  });

  it('keeps going after a task fails', async () => {
    const log: string[] = [];
    const queue = createTaskQueue(1);
    queue.enqueue(() => Promise.reject(new Error('boom')));
    queue.enqueue(async () => {
      log.push('after');
    });
    await tick();
    await tick();
    expect(log).toEqual(['after']);
  });
});
