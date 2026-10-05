import type {IpcMain} from 'electron';
import type {createLearningReviewCoordinator} from './learning-review-coordinator';
type Coordinator=ReturnType<typeof createLearningReviewCoordinator>;
export function registerLearningReviewIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;host:{reviewLearning:Coordinator['review'];decideLearning:Coordinator['decide'];learningHistory:Coordinator['history']}}){
 for(const [channel,method]of [['xiaozhi:learning-review','reviewLearning'],['xiaozhi:learning-decide','decideLearning'],['xiaozhi:learning-history','learningHistory']] as const)
  options.ipcMain.handle(channel,(event,input)=>options.allowed(event)?options.host[method](input):{ok:false,error:'permission_denied'});
}
