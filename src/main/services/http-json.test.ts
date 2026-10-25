import { beforeAll, describe, expect, it } from 'vitest';

import { applyLanguage } from '../../shared/i18n';
import { getHtml, getJson, MAX_RESPONSE_BYTES, type HttpOptions } from './http-json';

// The user-facing messages are checked in French; English is the interface's default.
beforeAll(() => applyLanguage('fr'));

function options(response: () => Response): HttpOptions {
  return { fetch: (async () => response()) as unknown as typeof fetch, userAgent: 'test', timeoutMs: 1000 };
}

/** A response whose final URL (after redirects) is `url`; `Response.url` is read-only. */
function from(body: BodyInit | null, url: string, init: ResponseInit = {}): Response {
  const response = new Response(body, init);
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

const PAGE = 'https://www.bedetheque.com/BD-Tintin-1.html';

describe('response size', () => {
  it('reads a normal JSON answer and a normal page', async () => {
    await expect(getJson('https://api.example/x', options(() => new Response('{"a":1}')), 'API')).resolves.toEqual({ a: 1 });
    await expect(getHtml(PAGE, options(() => new Response('<html></html>')), 'Bédéthèque')).resolves.toBe('<html></html>');
  });

  it('refuses a body that declares more than the limit', async () => {
    const huge = () => new Response('{}', { headers: { 'content-length': String(MAX_RESPONSE_BYTES + 1) } });
    await expect(getJson('https://api.example/x', options(huge), 'API')).rejects.toThrow(/trop volumineuse/);
    await expect(getHtml(PAGE, options(huge), 'Bédéthèque')).rejects.toThrow(/trop volumineuse/);
  });

  it('stops reading a body that grows past the limit without declaring it', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const stream = () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            sent += 1;
            controller.enqueue(chunk);
            if (sent > 50) controller.close();
          },
        }),
      );

    await expect(getHtml(PAGE, options(stream), 'Bédéthèque')).rejects.toThrow(/trop volumineuse/);
    expect(sent).toBeLessThan(10);
  });

  it('still reports an unreadable JSON answer as such', async () => {
    await expect(getJson('https://api.example/x', options(() => new Response('<html>')), 'API')).rejects.toThrow(/illisible/);
  });
});

describe('redirects', () => {
  it('follows a redirect inside the same site, www or not', async () => {
    const moved = () => from('<html></html>', 'https://bedetheque.com/BD-Tintin-1.html');
    await expect(getHtml(PAGE, options(moved), 'Bédéthèque')).resolves.toBe('<html></html>');
  });

  it('refuses a redirect that ends on another site', async () => {
    const elsewhere = () => from('<html></html>', 'https://evil.example/BD-Tintin-1.html');
    await expect(getHtml(PAGE, options(elsewhere), 'Bédéthèque')).rejects.toThrow(/autre site/);
    await expect(getJson('https://api.example/x', options(elsewhere), 'API')).rejects.toThrow(/autre site/);
  });
});

describe('stopping a lookup', () => {
  /** A fetch that never answers on its own: it only fails when the signal it was given is aborted. */
  const hanging = (): typeof fetch =>
    ((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      })) as typeof fetch;

  it('aborts the request when the lookup is stopped', async () => {
    const controller = new AbortController();
    const request = getHtml(PAGE, { fetch: hanging(), userAgent: 'test', timeoutMs: 60_000, signal: controller.signal }, 'Bédéthèque');
    controller.abort();
    await expect(request).rejects.toThrow(/Bédéthèque/);
  });
});
