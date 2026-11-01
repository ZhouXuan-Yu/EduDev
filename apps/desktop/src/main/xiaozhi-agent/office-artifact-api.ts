import type {createDeliveryCoordinator} from './delivery-coordinator';
import type {IpcMain} from 'electron';
import {shell} from 'electron';
import type {OfficeVersionInput,OfficeVersionResult} from '../../shared/xiaozhi-office-versions';
import type {createOfficeArtifactCoordinator} from './office-artifact-coordinator';
import type {ArtifactSourcesResult} from '../../shared/artifact-sources';
import type {DeliveryCatalogResult} from '../../shared/xiaozhi-delivery';
type Coordinator=ReturnType<typeof createOfficeArtifactCoordinator>;
export function registerOfficeArtifactIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;
 host:{deliveryCatalog:(input:unknown)=>Promise<DeliveryCatalogResult>;artifactSources:(input:unknown)=>Promise<ArtifactSourcesResult>;officeVersion:(input:OfficeVersionInput,useFile?:(file:string,action:'open'|'locate')=>Promise<void>)=>Promise<OfficeVersionResult>;decideDelivery:ReturnType<typeof createDeliveryCoordinator>['decide'];reviewOfficeArtifact:Coordinator['review'];reviseOfficeArtifact:Coordinator['revise'];decideOfficeArtifact:Coordinator['decide']}}){
 options.ipcMain.handle('xiaozhi:delivery-catalog',(event,input)=>options.allowed(event)?options.host.deliveryCatalog(input):{ok:false,error:'permission_denied'});
 options.ipcMain.handle('xiaozhi:artifact-sources',(event,input)=>options.allowed(event)?options.host.artifactSources(input):{ok:false,error:'permission_denied'});
 options.ipcMain.handle('xiaozhi:office-version',(event,input)=>options.allowed(event)?options.host.officeVersion(input,async(file,action)=>{try{if(action==='open'){if(await shell.openPath(file))throw Error('open_failed');}else shell.showItemInFolder(file);}catch{throw Error('open_failed');}}):{ok:false,error:'permission_denied'});
 for(const [channel,method] of [['xiaozhi:delivery-decide','decideDelivery'],['xiaozhi:office-review','reviewOfficeArtifact'],['xiaozhi:office-revise','reviseOfficeArtifact'],['xiaozhi:office-decide','decideOfficeArtifact']] as const)
  options.ipcMain.handle(channel,(event,input)=>options.allowed(event)?options.host[method](input):{ok:false,error:'permission_denied'});
}
