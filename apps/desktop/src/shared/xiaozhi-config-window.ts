import type { OrdinaryCommit, OrdinaryField, OrdinaryHistory, OrdinaryReceipt, OrdinaryTarget, OrdinaryUndo } from './xiaozhi-ordinary-config';
import type { XiaozhiSettingsError, XiaozhiSettingsResult } from './xiaozhi-settings';
import type { ThinkingChoice, ThinkingSetting } from './xiaozhi-thinking';

export type ConfigWindowView = {
  defaultModel: string;
  defaultModelOverride: string | null;
  modelVersion: number;
  models: { id: string }[];
  catalogueError?: XiaozhiSettingsError;
  globalThinking: ThinkingSetting;
  globalThinkingChoices: ThinkingChoice[];
  sessionThinking?: ThinkingSetting;
  sessionThinkingChoices?: ThinkingChoice[];
  locked: boolean;
};

export type ConfigWindowCommit = Omit<OrdinaryCommit, 'sessionId' | 'credentialId'>;
export type ConfigWindowUndo = Omit<OrdinaryUndo, 'sessionId'>;
export type ConfigWindowOpenOutcome = 'opened' | 'focused_existing' | 'focused_other_scope';
export type ConfigChange = OrdinaryTarget & { version: number };
export type ConfigWindowChange = { field: OrdinaryField; scope: 'global' | 'session'; version: number };

export interface ConfigWindowApi {
  read(): Promise<XiaozhiSettingsResult<ConfigWindowView>>;
  refreshModels(): Promise<XiaozhiSettingsResult<ConfigWindowView>>;
  history(field: OrdinaryField, cursor?: string): Promise<XiaozhiSettingsResult<OrdinaryHistory>>;
  commit(input: ConfigWindowCommit): Promise<XiaozhiSettingsResult<OrdinaryReceipt>>;
  undo(input: ConfigWindowUndo): Promise<XiaozhiSettingsResult<OrdinaryReceipt>>;
  onChange(listener: (change: ConfigWindowChange) => void): () => void;
}
