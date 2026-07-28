import type { OmniEduApi } from '../preload';

declare global {
  interface Window {
    omniEdu?: OmniEduApi;
  }
}

export {};
