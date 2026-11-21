export type WindowsUpdateStatus = 'ready' | 'invalid_name' | 'same_or_older' | 'signature_invalid'
  | 'release_missing' | 'release_unavailable' | 'package_mismatch' | 'incompatible' | 'file_unavailable';

export type WindowsUpdateCandidate = {
  id: string;
  fileName: string;
  currentVersion: string;
  dataVersion: number;
  targetVersion?: string;
  status: WindowsUpdateStatus;
  sha256?: string;
  targetDataVersion?: number;
};

export type WindowsUpdateSnapshot = {
  snapshotPath: string;
  recordPath: string;
  currentVersion: string;
  targetVersion: string;
};

export const WINDOWS_UPDATE_RECORD = 'xiaozhi.windows-update-preparation.v1';
export type UpdateRollback = {sourceVersion:string; targetVersion:string; preparedAt:string};
