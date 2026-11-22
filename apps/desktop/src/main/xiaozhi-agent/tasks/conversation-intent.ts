import type {XiaozhiStartInput} from '../../../shared/xiaozhi-agent';
import {isTaskAmendment, isTaskFollowUp} from './continuation';

const greeting = /^(?:你好|您好|小智你好|早上好|下午好|晚上好|谢谢|多谢|辛苦了|hello|hi|thanks)[，。！!\s]*$/iu;
const question = /[？?]$/u;
const knowledgeQuestion = /^(?:请问[，,]?\s*)?(?:什么是|为什么|为何|如何理解|怎样理解|怎么理解|有什么区别|请解释|请简述|简单解释|简要说明)/u;
const delivery = /(?:帮我|替我|给我|请|先|然后|再|并)(?:\s|一下)*(?:生成|制作|编写|整理|查找|查询|搜索|读取|打开|保存|导出|发送|安装|下载|运行|执行|修改|更新|部署|删除|写入|复制|合并|发布|组卷|出题|记住)/u;
const requestedArtifact = /(?:给|替|帮|为)我[一两几三四五六七八九十0-9]+\s*(?:份|套|篇|张)\s*(?:试卷|教案|讲义|课件|文件|练习|报告)/u;
const suppliedSource = /(?:刚才|之前|当前|以上|上面的|这[个份道张]|我(?:的|上传的|提供的|给的)|从)的?\s*(?:资料库|知识库|题库|附件|文件|会话|试卷|教案|讲义|课件|任务|成果|记录|学生|题目)|\bhttps?:\/\//iu;

/** Only clear requests for an answer may enter the tool-free conversation path. */
export function isStandaloneAnswer(input: Pick<XiaozhiStartInput,'prompt'|'attachments'|'presentation'|'continueTask'|'classroomPlan'|'resumeDeliveryId'|'paperExportIntent'>) {
    if(input.attachments?.length||input.presentation||input.continueTask||input.classroomPlan||input.resumeDeliveryId||input.paperExportIntent)return false;
    const text=input.prompt.trim().normalize('NFKC');
    if(!text||text.length>600||text.startsWith('/')||/\r|\n/u.test(text)||isTaskFollowUp(text)||isTaskAmendment(text))return false;
    if(greeting.test(text))return true;
    if(delivery.test(text)||requestedArtifact.test(text)||suppliedSource.test(text)||/^(?:请问\s*)?(?:能否|能不能|可以|可不可以|能帮)(?:\s)*(?:帮|替|给|做|查|搜|生|编|出|组|制|写|改|重|补|存|导|看|用|从)/u.test(text))return false;
    return knowledgeQuestion.test(text)||question.test(text)&&/(?:什么|为何|为啥|怎样|怎么|如何|多少|几|是否|区别|哪|吗|呢|^who\b|^what\b|^why\b|^how\b)/iu.test(text);
}
