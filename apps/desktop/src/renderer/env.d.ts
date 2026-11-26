import type { OmniEduApi } from '../preload';
import type {SettingsWindowClient,SettingsHostClient} from '../shared/settings-window';

declare global {
  interface Window {
    omniEdu?: OmniEduApi;
    settingsWindow?:SettingsWindowClient;
    settingsHost?:SettingsHostClient;
  }
}

export {};
