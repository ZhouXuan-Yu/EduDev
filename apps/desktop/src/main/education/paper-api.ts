import type {IpcMain} from 'electron';
import {PAPER_ERRORS,type PaperCompareInput,type PaperCompareView,type PaperError,type PaperResult} from '../../shared/paper-blueprint';
import type {createPaperCoordinator} from './paper-coordinator';
type Coordinator=ReturnType<typeof createPaperCoordinator>;
type Host={listPapers:Coordinator['list'];listPaperGenerationContexts:Coordinator['generationContexts'];createPaper:(input:Parameters<Coordinator['create']>[0])=>ReturnType<Coordinator['create']>;reviewPaper:Coordinator['review'];decidePaper:Coordinator['decide'];cancelPaper:Coordinator['cancelInput'];comparePapers:(input:PaperCompareInput)=>Promise<PaperCompareView>};
const failure=(e:unknown):PaperError=>{const message=(e as Error)?.message;return message&&Object.prototype.hasOwnProperty.call(PAPER_ERRORS,message)?message as PaperError:'unavailable';};
export function registerPaperIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;host:Host}){
 for(const [channel,method]of [['education:paper-generation-contexts','listPaperGenerationContexts'],['education:paper-list','listPapers'],['education:paper-create','createPaper'],['education:paper-review','reviewPaper'],['education:paper-decide','decidePaper'],['education:paper-cancel','cancelPaper']] as const)options.ipcMain.handle(channel,(event,input)=>options.allowed(event)?options.host[method](input):{ok:false,error:'permission_denied'});
 options.ipcMain.handle('education:paper-compare',async(event,input):Promise<PaperResult<PaperCompareView>>=>{if(!options.allowed(event))return{ok:false,error:'permission_denied'};try{return{ok:true,value:await options.host.comparePapers(input)};}catch(e){return{ok:false,error:failure(e)};}});
}
