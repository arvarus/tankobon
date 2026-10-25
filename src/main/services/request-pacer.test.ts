import { describe, expect, it } from 'vitest';

import { createRequestPacer, type PacerClock } from './request-pacer';

/** A clock the test moves by hand: `sleep()` only records the wait it was asked for. */
function fakeClock() {
  const waits: number[] = [];
  const clock: PacerClock & { time: number } = {
    time: 1000,
    now: () => clock.time,
    sleep: async (ms, signal) => {
      signal?.throwIfAborted();
      waits.push(ms);
    },
  };
  return { clock, waits };
}

describe('createRequestPacer', () => {
  it('lets the first request through at once', async () => {
    const { clock, waits } = fakeClock();
    await createRequestPacer(1000, clock).wait();
    expect(waits).toEqual([]);
  });

  it('spaces requests that arrive together, one slot after another', async () => {
    const { clock, waits } = fakeClock();
    const pacer = createRequestPacer(1000, clock);
    await Promise.all([pacer.wait(), pacer.wait(), pacer.wait()]);
    expect(waits).toEqual([1000, 2000]);
  });

  it('waits only for what is left of the interval', async () => {
    const { clock, waits } = fakeClock();
    const pacer = createRequestPacer(1000, clock);
    await pacer.wait();
    clock.time += 400;
    await pacer.wait();
    expect(waits).toEqual([600]);
  });

  it('does not wait once the interval has passed', async () => {
    const { clock, waits } = fakeClock();
    const pacer = createRequestPacer(1000, clock);
    await pacer.wait();
    clock.time += 5000;
    await pacer.wait();
    expect(waits).toEqual([]);
  });

  it('refuses to wait for a request already cancelled', async () => {
    const { clock } = fakeClock();
    await expect(createRequestPacer(1000, clock).wait(AbortSignal.abort())).rejects.toThrow();
  });

  it('gives up a wait when the signal is aborted, with the real clock', async () => {
    const pacer = createRequestPacer(60_000);
    await pacer.wait();
    const controller = new AbortController();
    const waiting = pacer.wait(controller.signal);
    controller.abort(new Error('stopped'));
    await expect(waiting).rejects.toThrow('stopped');
  });
});
