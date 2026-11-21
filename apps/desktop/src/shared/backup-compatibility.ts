export type BackupVersion = { appVersion: string; dataVersion: number };

export type BackupCompatibility = {
  sourceAppVersion?: string;
  legacyRuntimeVersion?: string;
  currentAppVersion: string;
  dataVersion: number;
  status: 'ready' | 'legacy' | 'newer_app' | 'newer_data';
};
