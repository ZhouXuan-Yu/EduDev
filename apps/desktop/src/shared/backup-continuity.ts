export type BackupContinuity = {
  status: 'checked';
  defaultModel: boolean;
  defaultThinking: boolean;
  sessionModels: number | null;
  sessionThinking: number | null;
  personalSkills: number | null;
  paperTemplates: number | null;
  savedWorkspaces: number | null;
  modelCredentialRecorded: boolean;
} | { status: 'unavailable' };
