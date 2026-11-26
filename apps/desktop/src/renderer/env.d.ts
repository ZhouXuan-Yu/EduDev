import type { OmniEduApi } from '../preload';
import type { ConfigWindowApi } from '../shared/xiaozhi-config-window';

declare global {
  interface Window {
    omniEdu?: OmniEduApi;
    xiaozhiConfigWindow?: ConfigWindowApi;
  }
}

export {};
