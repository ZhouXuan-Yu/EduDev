import type {IpcMain} from 'electron';
import type {createQuestionReviewCoordinator} from './question-review-coordinator';
type Coordinator=ReturnType<typeof createQuestionReviewCoordinator>;
export function registerQuestionReviewIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;host:{reviewQuestions:Coordinator['review'];decideQuestions:Coordinator['decide']}}){
 for(const [channel,method]of [['xiaozhi:question-review','reviewQuestions'],['xiaozhi:question-decide','decideQuestions']] as const)
  options.ipcMain.handle(channel,(event,input)=>options.allowed(event)?options.host[method](input):{ok:false,error:'permission_denied'});
}
