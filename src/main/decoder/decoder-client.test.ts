import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { applyLanguage } from '../../shared/i18n';
import { DecoderClient, type DecoderChannel } from './decoder-client';
import type { DecoderInbound, DecoderResponse } from './protocol';

// The user-facing messages are checked in French; English is the interface's default.
beforeAll(() => applyLanguage('fr'));

/** A decoder process that answers through `reply` and can be made to die. */
class FakeChannel implements DecoderChannel {
  readonly received: DecoderInbound[] = [];
  killed = false;
  private respond: (response: DecoderResponse) => void = () => undefined;
  private exit: () => void = () => undefined;

  constructor(private readonly reply: (message: DecoderInbound, send: (r: DecoderResponse) => void) => void) {}

  post(message: DecoderInbound): void {
    this.received.push(message);
    this.reply(message, (response) => this.respond(response));
  }
  onResponse(listener: (response: DecoderResponse) => void): void {
    this.respond = listener;
  }
  onExit(listener: () => void): void {
    this.exit = listener;
  }
  kill(): void {
    this.killed = true;
  }
  die(): void {
    this.exit();
  }
}

const echo = (message: DecoderInbound, send: (r: DecoderResponse) => void): void => {
  if (message.type === 'request') {
    send({ type: 'response', id: message.id, ok: true, result: { path: message.args[0] } });
  }
};

describe('DecoderClient', () => {
  it('starts the process on the first call, initialised with the thumbnails directory and language', async () => {
    const channels: FakeChannel[] = [];
    const client = new DecoderClient(() => {
      channels.push(new FakeChannel(echo));
      return channels[0];
    }, '/cache');
    expect(channels).toHaveLength(0);

    await client.open('/a.cbz');
    await client.open('/b.cbz');

    expect(channels).toHaveLength(1);
    expect(channels[0].received[0]).toEqual({ type: 'init', thumbnailsDirectory: '/cache', language: 'fr' });
    expect(channels[0].received).toHaveLength(3);
  });

  it('pairs each answer with its call, in whatever order they come back', async () => {
    const held: Array<() => void> = [];
    const channel = new FakeChannel((message, send) => {
      if (message.type === 'request') {
        held.push(() => send({ type: 'response', id: message.id, ok: true, result: { path: message.args[0] } }));
      }
    });
    const client = new DecoderClient(() => channel, '/cache');

    const first = client.open('/a.cbz');
    const second = client.open('/b.cbz');
    held[1]();
    held[0]();

    await expect(first).resolves.toEqual({ path: '/a.cbz' });
    await expect(second).resolves.toEqual({ path: '/b.cbz' });
  });

  it("rejects with the process's own message when a call fails", async () => {
    const channel = new FakeChannel((message, send) => {
      if (message.type === 'request') {
        send({ type: 'response', id: message.id, ok: false, message: 'Aucune image' });
      }
    });
    await expect(new DecoderClient(() => channel, '/cache').open('/a.cbz')).rejects.toThrow('Aucune image');
  });

  it('turns a crash into an "unreadable file" error for every pending call, then starts a new process', async () => {
    const channels: FakeChannel[] = [];
    const client = new DecoderClient(() => {
      const channel = new FakeChannel(channels.length === 0 ? () => undefined : echo);
      channels.push(channel);
      return channel;
    }, '/cache');

    const first = client.open('/booby-trapped.pdf');
    const second = client.readPage('id', 0);
    channels[0].die();

    await expect(first).rejects.toThrow('Fichier illisible');
    await expect(second).rejects.toThrow('Fichier illisible');

    await expect(client.open('/fine.cbz')).resolves.toEqual({ path: '/fine.cbz' });
    expect(channels).toHaveLength(2);
    expect(channels[1].received[0]).toMatchObject({ type: 'init' });
  });

  it('ignores the exit of a process it already replaced', async () => {
    const channels: FakeChannel[] = [];
    const client = new DecoderClient(() => {
      channels.push(new FakeChannel(echo));
      return channels[channels.length - 1];
    }, '/cache');
    await client.open('/a.cbz');
    channels[0].die();
    await client.open('/b.cbz');
    channels[0].die();

    await expect(client.open('/c.cbz')).resolves.toEqual({ path: '/c.cbz' });
    expect(channels).toHaveLength(2);
  });

  it('forwards a language change to the running process, and remembers it for the next one', async () => {
    const channels: FakeChannel[] = [];
    const client = new DecoderClient(() => {
      channels.push(new FakeChannel(echo));
      return channels[channels.length - 1];
    }, '/cache');
    await client.open('/a.cbz');

    client.setLanguage('en');
    expect(channels[0].received.at(-1)).toEqual({ type: 'language', language: 'en' });

    channels[0].die();
    await client.open('/b.cbz');
    expect(channels[1].received[0]).toEqual({ type: 'init', thumbnailsDirectory: '/cache', language: 'en' });
  });

  it('kills the process on dispose', async () => {
    const channel = new FakeChannel(echo);
    const client = new DecoderClient(() => channel, '/cache');
    await client.open('/a.cbz');
    client.dispose();
    expect(channel.killed).toBe(true);
  });

  describe('timeout', () => {
    afterEach(() => vi.useRealTimers());

    /** A first process that never answers, then well-behaved ones. */
    function hangingClient() {
      const channels: FakeChannel[] = [];
      const client = new DecoderClient(
        () => {
          channels.push(new FakeChannel(channels.length === 0 ? () => undefined : echo));
          return channels[channels.length - 1];
        },
        '/cache',
        1000,
      );
      return { channels, client };
    }

    it('abandons a call that opens a file when it hangs: kills the process, fails the others, starts afresh', async () => {
      vi.useFakeTimers();
      const { channels, client } = hangingClient();

      const hung = client.open('/trap.pdf');
      const other = client.readPage('id', 0);
      const hungResult = expect(hung).rejects.toThrow('trop de temps');
      const otherResult = expect(other).rejects.toThrow('Fichier illisible');
      await vi.advanceTimersByTimeAsync(1000);
      await hungResult;
      await otherResult;

      expect(channels[0].killed).toBe(true);
      await expect(client.open('/fine.cbz')).resolves.toEqual({ path: '/fine.cbz' });
      expect(channels).toHaveLength(2);
    });

    it('does not time out the calls that are not about opening a file', async () => {
      vi.useFakeTimers();
      const { channels, client } = hangingClient();

      let settled = false;
      void client.readPage('id', 0).then(
        () => (settled = true),
        () => (settled = true),
      );
      await vi.advanceTimersByTimeAsync(10_000);

      expect(settled).toBe(false);
      expect(channels[0].killed).toBe(false);
    });

    it('leaves a call that is answered in time alone', async () => {
      vi.useFakeTimers();
      const channel = new FakeChannel(echo);
      const client = new DecoderClient(() => channel, '/cache', 1000);

      await expect(client.open('/a.cbz')).resolves.toEqual({ path: '/a.cbz' });
      await vi.advanceTimersByTimeAsync(5000);

      expect(channel.killed).toBe(false);
    });
  });
});
