import { isSupportedComicFile } from '../../shared/comic';
import type { PickedFiles } from './picked-files';

/**
 * The comic the operating system asked the app to open (double click in the file explorer, "Open
 * with…", a second launch with a file). The main process offers the path; the renderer takes the
 * token and opens it like a file picked in the dialog. Only the latest offer is kept: the renderer
 * takes it as soon as it is told, and a window that is still loading takes it when it starts.
 */
export class LaunchFiles {
  private pending: string | null = null;

  /** `notify` tells the windows an offer is waiting. */
  constructor(
    private readonly picked: PickedFiles,
    private readonly notify: () => void,
  ) {}

  /** Offers `path`; anything but a supported comic is ignored. Returns whether it was taken. */
  offer(path: string): boolean {
    if (!isSupportedComicFile(path)) return false;
    // Not added to the library by force: the "add opened books" setting decides, as for the reader's picker.
    this.pending = this.picked.add(path, false);
    this.notify();
    return true;
  }

  /** The token of the waiting offer, if any; it is handed out once. */
  take(): string | null {
    const token = this.pending;
    this.pending = null;
    return token;
  }
}
