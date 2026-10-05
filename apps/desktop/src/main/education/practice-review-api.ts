import type {IpcMain} from 'electron';
import type {createPracticeReviewCoordinator} from './practice-review-coordinator';
type Coordinator=ReturnType<typeof createPracticeReviewCoordinator>;
export function registerPracticeReviewIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;host:{reviewPractice:Coordinator['review'];decidePractice:Coordinator['decide'];practiceSource:Coordinator['source']}}){
 for(const [channel,method]of [['xiaozhi:practice-review','reviewPractice'],['xiaozhi:practice-decide','decidePractice'],['education:practice-source','practiceSource']] as const)options.ipcMain.handle(channel,(event,input)=>options.allowed(event)?options.host[method](input):{ok:false,error:'permission_denied'});
}
