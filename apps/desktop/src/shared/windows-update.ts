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
