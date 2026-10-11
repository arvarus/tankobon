import { MAIN_PROCESS_SETTINGS, isApiKeySetting, isSettingKey, isValidSetting, pickApiKeys, toPublicSettings } from '../../shared/settings';
import type { SettingsRepository } from '../db/settings-repository';
import { applyMainLanguage } from '../language';
import type { NotifyDataChange } from './data-changes';
import { handle } from './handle';
import { IpcArgumentError, args } from './validate';

// Channel names are shared with preload.ts: keep them in sync.
export const SETTINGS_CHANNELS = {
  getAll: 'settings:get-all',
  getApiKeys: 'settings:get-api-keys',
  set: 'settings:set',
} as const;

function keyArg(key: unknown) {
  if (!isSettingKey(key) || MAIN_PROCESS_SETTINGS.includes(key)) {
    throw new IpcArgumentError('key', 'a setting name the renderer may write');
  }
  return key;
}

export function registerSettingsIpc(repo: SettingsRepository, notify: NotifyDataChange): void {
  // The API keys only go to the Métadonnées page, through their own channel.
  handle(SETTINGS_CHANNELS.getAll, args(), () => toPublicSettings(repo.getAll()));

  handle(SETTINGS_CHANNELS.getApiKeys, args(), () => pickApiKeys(repo.getAll()));

  handle(
    SETTINGS_CHANNELS.set,
    args(keyArg, (value) => value),
    (_event, key, value) => {
      // The value is checked against the key it is stored under.
      if (!isValidSetting(key, value)) {
        throw new IpcArgumentError('value', `a valid value for the setting "${key}"`);
      }
      repo.set(key, value);
      if (key === 'language') applyMainLanguage(String(value));
      // The API keys never reach the store: nothing public changed.
      if (!isApiKeySetting(key)) notify({ scope: 'settings', values: { [key]: value } });
    },
  );
}
