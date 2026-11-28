import type {XiaozhiStartInput} from '../../../shared/xiaozhi-agent';
import {isTaskAmendment, isTaskFollowUp} from './continuation';

const greeting = /^(?:你好|您好|小智你好|早上好|下午好|晚上好|谢谢|多谢|辛苦了|hello|hi|thanks)[，。！!\s]*$/iu;
const question = /[？?]$/u;
const knowledgeQuestion = /^(?:请问[，,]?\s*)?(?:什么是|为什么|为何|如何理解|怎样理解|怎么理解|有什么区别|请解释|请简述|简单解释|简要说明)/u;
const delivery = /(?:帮我|替我|给我|请|先|然后|再|并)(?:\s|一下)*(?:生成|制作|编写|整理|查找|查询|搜索|读取|打开|保存|导出|发送|安装|下载|运行|执行|修改|更新|部署|删除|写入|复制|合并|发布|组卷|出题|记住)/u;
const requestedArtifact = /(?:给|替|帮|为)我[一两几三四五六七八九十0-9]+\s*(?:份|套|篇|张)\s*(?:试卷|教案|讲义|课件|文件|练习|报告)/u;
const suppliedSource = /(?:刚才|之前|当前|以上|上面的|这[个份道张]|我(?:的|上传的|提供的|给的)|从)的?\s*(?:资料库|知识库|题库|附件|文件|会话|试卷|教案|讲义|课件|任务|成果|记录|学生|题目)|\bhttps?:\/\//iu;

/** The teacher asks to resolve an ambiguous historical source before using it. */
export function requestsHistoryClarification(prompt:string){
  const text=prompt.normalize('NFKC').trim();
  if(text.length>240||/[“”「」"'《》\n]/u.test(text))return false;
  const clauses=text.replace(/[。！？!?]+$/u,'').split(/[，,；;。]/u);
  if(clauses.length!==2)return false;
  const [sources,request]=clauses.map(clause=>clause.trim());
  return /(?:历史(?:对话|资料|来源|记录)|班级记录)/u.test(sources)&&/(?:同名|重名|名字相同|名称相同)/u.test(sources)&&
    /^(?:请)?(?:先)?(?:给我确认|让我(?:先)?选|问我(?:要)?用|我先选|跟我确认|向我确认)(?:一下)?(?:目标|哪一份|哪个班级|哪个班|哪份|一份|哪段对话)$/u.test(request);
}

export function requestsPaperClarification(prompt:string){
  const text=prompt.normalize('NFKC').trim();
  return /^(?:请(?:帮我)?|帮我)?(?:修改|调整|编辑|修订)(?:一下)?(?:另(?:外)?一(?:份|张|套)|那(?:份|张|套))的?(?:同名|重名)(?:的)?(?:试卷|测验卷|练习卷|模拟卷)[。！!\s]*$/u.test(text);
}

export function sourceClarificationQuestion(kind:'history'|'handout'|'paper'){
  if(kind==='paper')return {question:'请填写要改的试卷及修改位置。同名时可用题目、知识点或原对话区分。',options:['先到原对话核对','暂不修改']};
  return kind==='handout'
    ?{question:'请填写要继续的讲义完整书名，例如“请继续《完整书名》”。',options:['先到讲义编辑器核对','暂不继续']}
    :{question:'请填写要参考的班级及记录。选定后可在聊天的历史引用入口预览来源。',options:['先核对原对话','暂不使用历史']};
}

/** Only clear requests for an answer may enter the tool-free conversation path. */
export function isStandaloneAnswer(input: Pick<XiaozhiStartInput,'prompt'|'attachments'|'presentation'|'continueTask'|'classroomPlan'|'resumeDeliveryId'|'paperExportIntent'|'mockExamExportIntent'>) {
    if(input.attachments?.length||input.presentation||input.continueTask||input.classroomPlan||input.resumeDeliveryId||input.paperExportIntent||input.mockExamExportIntent)return false;
    const text=input.prompt.trim().normalize('NFKC');
    if(!text||text.length>600||text.startsWith('/')||/\r|\n/u.test(text)||isTaskFollowUp(text)||isTaskAmendment(text))return false;
    if(greeting.test(text))return true;
    if(delivery.test(text)||requestedArtifact.test(text)||suppliedSource.test(text)||/^(?:请问\s*)?(?:能否|能不能|可以|可不可以|能帮)(?:\s)*(?:帮|替|给|做|查|搜|生|编|出|组|制|写|改|重|补|存|导|看|用|从)/u.test(text))return false;
    return knowledgeQuestion.test(text)||question.test(text)&&/(?:什么|为何|为啥|怎样|怎么|如何|多少|几|是否|区别|哪|吗|呢|^who\b|^what\b|^why\b|^how\b)/iu.test(text);
}
