import type { OmniEduApi } from '../preload';
import type { ConfigWindowApi } from '../shared/xiaozhi-config-window';
import type {SettingsWindowClient,SettingsHostClient} from '../shared/settings-window';

declare global {
  interface Window {
    omniEdu?: OmniEduApi;
    xiaozhiConfigWindow?: ConfigWindowApi;
    settingsWindow?:SettingsWindowClient;
    settingsHost?:SettingsHostClient;
  }
}

export {};
