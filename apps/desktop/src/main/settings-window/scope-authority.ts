import type { IpcMainInvokeEvent } from 'electron';

export type SettingsScope = Readonly<{schemaVersion: 'settings.scope.v1'; epoch: number; sessionId: string | null; revision: string | null}>;
export interface ScopeAuthorityOptions {
  trustedMain: (event: IpcMainInvokeEvent) => boolean;
  trustedSettings: (event: IpcMainInvokeEvent) => boolean;
  readRevision: (sessionId: string) => Promise<string | null>;
  changed: (scope: SettingsScope) => void;
}
/** Selection capability, not a configuration or session store. Host facts stay authoritative. */
export class SettingsScopeAuthority {
  private options: ScopeAuthorityOptions;
  private current: SettingsScope = Object.freeze({schemaVersion:'settings.scope.v1',epoch:0,sessionId:null,revision:null});
  constructor(options: ScopeAuthorityOptions) { this.options=options; }
  snapshot(): SettingsScope { return {...this.current}; }
  async select(event: IpcMainInvokeEvent, sessionId: unknown): Promise<SettingsScope> {
    if(!this.options.trustedMain(event))throw Error('permission_denied');
    if(sessionId!==null&&(typeof sessionId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)))throw Error('invalid_input');
    const epoch=this.current.epoch+1;
    // Revoke previous permits before any asynchronous host lookup.
    this.current=Object.freeze({schemaVersion:'settings.scope.v1',epoch,sessionId:null,revision:null});this.options.changed(this.snapshot());
    const revision=sessionId===null?null:await this.options.readRevision(sessionId);
    if(this.current.epoch!==epoch)throw Error('scope_changed');
    if(sessionId!==null&&(revision===null||typeof revision!=='string'||!revision.length))throw Error('session_unavailable');
    this.current=Object.freeze({schemaVersion:'settings.scope.v1',epoch,sessionId,revision});this.options.changed(this.snapshot());
    return this.snapshot();
  }
  async assertCurrent(event: IpcMainInvokeEvent, scope: SettingsScope, sessionId?: string): Promise<void> {
    if(!this.options.trustedSettings(event))throw Error('permission_denied');
    if(scope.schemaVersion!=='settings.scope.v1'||scope.epoch!==this.current.epoch||scope.sessionId!==this.current.sessionId||scope.revision!==this.current.revision)throw Error('scope_changed');
    if(sessionId!==undefined&&(!this.current.sessionId||sessionId!==this.current.sessionId))throw Error('scope_changed');
    if(sessionId!==undefined){
      const revision=await this.options.readRevision(sessionId);
      if(revision!==scope.revision||scope.epoch!==this.current.epoch)throw Error('scope_changed');
    }
    if(!this.options.trustedSettings(event))throw Error('permission_denied');
  }
}
