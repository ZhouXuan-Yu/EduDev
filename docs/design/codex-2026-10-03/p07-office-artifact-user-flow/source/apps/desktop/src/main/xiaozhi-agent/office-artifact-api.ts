import type {IpcMain} from 'electron';
import type {createOfficeArtifactCoordinator} from './office-artifact-coordinator';
type Coordinator=ReturnType<typeof createOfficeArtifactCoordinator>;
export function registerOfficeArtifactIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;
 host:{reviewOfficeArtifact:Coordinator['review'];reviseOfficeArtifact:Coordinator['revise'];decideOfficeArtifact:Coordinator['decide']}}){
 for(const [channel,method] of [['xiaozhi:office-review','reviewOfficeArtifact'],['xiaozhi:office-revise','reviseOfficeArtifact'],['xiaozhi:office-decide','decideOfficeArtifact']] as const)
  options.ipcMain.handle(channel,(event,input)=>options.allowed(event)?options.host[method](input):{ok:false,error:'permission_denied'});
}
