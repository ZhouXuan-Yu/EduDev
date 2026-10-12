import type {IpcMain} from 'electron';
import type {createPaperCoordinator} from './paper-coordinator';
type Coordinator=ReturnType<typeof createPaperCoordinator>;
export function registerPaperIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;host:{listPapers:Coordinator['list'];listPaperGenerationContexts:Coordinator['generationContexts'];createPaper:(input:Parameters<Coordinator['create']>[0])=>ReturnType<Coordinator['create']>;reviewPaper:Coordinator['review'];decidePaper:Coordinator['decide'];cancelPaper:Coordinator['cancelInput']}}){
 for(const [channel,method]of [['education:paper-generation-contexts','listPaperGenerationContexts'],['education:paper-list','listPapers'],['education:paper-create','createPaper'],['education:paper-review','reviewPaper'],['education:paper-decide','decidePaper'],['education:paper-cancel','cancelPaper']] as const)options.ipcMain.handle(channel,(event,input)=>options.allowed(event)?options.host[method](input):{ok:false,error:'permission_denied'});
}
