import type {IpcMain} from 'electron';
import type {createQuestionReviewCoordinator} from './question-review-coordinator';
import type {createQuestionCollectionCoordinator} from './question-collection-coordinator';
type Collection=ReturnType<typeof createQuestionCollectionCoordinator>;
type Coordinator=ReturnType<typeof createQuestionReviewCoordinator>;
export function registerQuestionReviewIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;host:{reviewQuestions:Coordinator['review'];decideQuestions:Coordinator['decide'];reviewQuestionCollection:Collection['review'];decideQuestionCollection:Collection['decide']}}){
 for(const [channel,method]of [['xiaozhi:question-review','reviewQuestions'],['xiaozhi:question-decide','decideQuestions'],['xiaozhi:question-collection-review','reviewQuestionCollection'],['xiaozhi:question-collection-decide','decideQuestionCollection']] as const)
  options.ipcMain.handle(channel,(event,input)=>options.allowed(event)?options.host[method](input):{ok:false,error:'permission_denied'});
}
