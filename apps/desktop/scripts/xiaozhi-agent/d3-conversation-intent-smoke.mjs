import assert from 'node:assert/strict';
import {isStandaloneAnswer} from '../../src/main/xiaozhi-agent/tasks/conversation-intent.ts';
import {isBoundTaskAmendment} from '../../src/main/xiaozhi-agent/tasks/continuation.ts';

const answers=['你好！','什么是等值分数？','为什么会有四季','请解释小数的计数单位','1+1 等于几？',
    'What is a polynomial?','一元一次方程和一元二次方程有什么区别？',
    '请用一句话解释什么是磁力，只在聊天中回答。','请用两三句话说明为什么会有四季。',
    '请用简短的话解释惯性。'];
const tasks=['继续','好的','改成八年级讲义','能不能从题库里挑三道题？','请把这份试卷导出','请制作一份五年级讲义',
    '为什么之前的课件打不开？','什么是等值分数？并给我一份练习','/skill:teaching-office 什么是等值分数？',
    '请解释这道题目','请解释分数\n再保存到文件','什么是这个文件中的附件？',
    '请用一句话解释附件里的结论。','请用一句话解释磁力，再导出成文件。',
    '请用两句话说明刚才的讲义为什么没有答案。','请用这个工具解释磁力。'];
for(const prompt of answers)assert(isStandaloneAnswer({prompt}),prompt);
for(const prompt of tasks)assert(!isStandaloneAnswer({prompt}),prompt);
const prompt=answers[1];
for(const options of [{attachments:[{id:'attachment',revision:1}]},{presentation:{}},{continueTask:{}},{classroomPlan:{}},
    {paperExportIntent:{}},{resumeDeliveryId:'delivery-id'}])assert(!isStandaloneAnswer({prompt,...options}),JSON.stringify(options));
const amendments=['继续当前任务，只把《某一讲义》第三题的题干改为口头练习。','请接着这个任务，仅将最后一段改为小结。','请把刚才的讲义改为八年级，其他要求照旧。','改为两道练习。','请在这份教案增加板书。'];
const newRequests=['同事说要继续当前任务，新建另一份讲义。','继续当前任务，是否需要换教材？','新建一份讲义把题型改为计算','为什么之前的讲义删去了过程？','修改另一份教案','继续'];
for(const prompt of amendments)assert(isBoundTaskAmendment(prompt),prompt);
for(const prompt of newRequests)assert(!isBoundTaskAmendment(prompt),prompt);
console.log(JSON.stringify({passed:answers.length+tasks.length+6+amendments.length+newRequests.length,
    answers:answers.length,tasks:tasks.length,structuredStarts:6,amendments:amendments.length,newRequests:newRequests.length}));
