/**
 * The one way to register an IPC handler: the arguments are parsed before the handler runs.
 * See ADR 0009.
 * @module
 */
import { ipcMain, type IpcMainInvokeEvent } from 'electron';

import { assertTrustedSender } from './trusted-sender';
import type { ArgsParser } from './validate';

/**
 * `ipcMain.handle()` that cannot be written without argument validation (and that only answers the
 * application's own page, see `trusted-sender.ts`): `parse` (built with
 * `args()` from the guards of `validate.ts`) turns the raw arguments into the typed ones `fn`
 * receives, or throws an `IpcArgumentError` and the call is rejected without `fn` running.
 */
export function handle<A extends unknown[], R>(
  channel: string,
  parse: ArgsParser<A>,
  fn: (event: IpcMainInvokeEvent, ...args: A) => R,
): void {
  ipcMain.handle(channel, (event, ...raw: unknown[]) => {
    assertTrustedSender(event);
    return fn(event, ...parse(raw));
  });
}
