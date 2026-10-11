import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import { applyAppMenu } from './main/app-menu';
import { DecoderClient } from './main/decoder/decoder-client';
import { spawnDecoderProcess } from './main/decoder/spawn-decoder';
import { AchievementRepository } from './main/db/achievement-repository';
import { openDatabase } from './main/db/database';
import { LibraryFolderRepository } from './main/db/library-folder-repository';
import { LibraryRepository } from './main/db/library-repository';
import { ReadingListRepository } from './main/db/reading-list-repository';
import { StatsRepository } from './main/db/stats-repository';
import { SettingsRepository } from './main/db/settings-repository';
import { broadcastDataChange } from './main/ipc/data-changes';
import { registerAchievementsIpc } from './main/ipc/achievements';
import { registerAppIpc } from './main/ipc/app';
import { registerComicIpc } from './main/ipc/comic';
import { registerDatabaseIpc } from './main/ipc/database';
import { registerDataIpc } from './main/ipc/data';
import {
  broadcastImageScanProgress,
  createLibraryOrganizer,
  createResynchronizer,
  registerLibraryIpc,
} from './main/ipc/library';
import { registerMetadataIpc } from './main/ipc/metadata';
import { registerReadingListIpc } from './main/ipc/reading-lists';
import { registerStatsIpc } from './main/ipc/stats';
import { registerSettingsIpc } from './main/ipc/settings';
import { applyMainLanguage, onMainLanguageApplied } from './main/language';
import { createImageStatsScanner } from './main/services/image-stats-scanner';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Development mode (`npm run dev`, see forge.config.ts): only there are DevTools opened.
const isDevMode = !app.isPackaged && process.env.TANKOBON_DEV === '1';

// The window icon (taskbar and title bar on Linux; Windows and macOS take the executable's own).
// Packaged, the PNG is copied next to the app by `extraResource` (forge.config.ts).
const windowIcon = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.png')
  : path.join(app.getAppPath(), 'assets', 'icon.png');

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Tankōbon',
    icon: windowIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // The window only ever shows the app itself: no navigation away from it (a dropped file or a
  // clicked link would replace the UI, and a page loaded there could reach `window.tankobon`),
  // and no new window. Links go through `app:open-link` instead.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (isDevMode) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

app.whenReady().then(() => {
  const db = openDatabase();
  const libraryRepo = new LibraryRepository(db);
  const folderRepo = new LibraryFolderRepository(db);
  const settingsRepo = new SettingsRepository(db);
  const readingListRepo = new ReadingListRepository(db);
  const achievementRepo = new AchievementRepository(db);
  const statsRepo = new StatsRepository(db);
  // Archives and covers are decoded in their own process: a booby-trapped file can only take that one down.
  // The thumbnails are a cache, so they stay in userData even when the database lives elsewhere.
  const decoder = new DecoderClient(spawnDecoderProcess, path.join(app.getPath('userData'), 'thumbnails'));
  onMainLanguageApplied((language) => decoder.setLanguage(language));
  // Before anything can show a dialog or return an error message.
  onMainLanguageApplied(() => applyAppMenu(isDevMode));
  applyMainLanguage(settingsRepo.getAll().language);
  // Leftovers of another database (its location changed) or of a crash between two writes.
  void decoder.pruneThumbnails(libraryRepo.list().map((entry) => entry.path)).catch(() => undefined);

  // Measures the pages of the books (average width and height) in the background, one book at a time.
  const imageScanner = createImageStatsScanner(libraryRepo, {
    measure: (filePath) => decoder.measure(filePath),
    onProgress: broadcastImageScanProgress,
    onUpdated: (entries) => broadcastDataChange({ scope: 'library', upserted: entries }),
  });
  // Moves the added books into the organized folder, when the setting asks for it.
  const organizer = createLibraryOrganizer(libraryRepo, settingsRepo, decoder, broadcastDataChange);
  const resynchronizer = createResynchronizer(
    libraryRepo,
    folderRepo,
    settingsRepo,
    decoder,
    broadcastDataChange,
    imageScanner,
    organizer,
  );
  registerLibraryIpc(
    libraryRepo,
    folderRepo,
    resynchronizer,
    settingsRepo,
    decoder,
    broadcastDataChange,
    imageScanner,
    organizer,
  );
  registerReadingListIpc(readingListRepo, broadcastDataChange);
  registerStatsIpc(statsRepo);
  registerSettingsIpc(settingsRepo, broadcastDataChange);
  registerDataIpc(db, libraryRepo, settingsRepo, readingListRepo, decoder, broadcastDataChange, imageScanner);
  registerComicIpc(libraryRepo, settingsRepo, decoder, broadcastDataChange, imageScanner);
  registerDatabaseIpc();
  registerMetadataIpc(settingsRepo);
  registerAchievementsIpc(achievementRepo, broadcastDataChange);
  registerAppIpc();

  app.on('will-quit', () => {
    decoder.dispose();
    db.close();
  });

  createWindow();

  // In the background: the library is usable meanwhile, and its views update as the walk goes.
  if (settingsRepo.getAll().resyncOnStartup) {
    void resynchronizer.run();
  }
  // Books left unmeasured by an earlier session (or a database from before the measure existed).
  void imageScanner.kick();
});

// Quit when all windows are closed, except on macOS where apps stay active
// until the user quits explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create a window when the dock icon is clicked and no window is open.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
