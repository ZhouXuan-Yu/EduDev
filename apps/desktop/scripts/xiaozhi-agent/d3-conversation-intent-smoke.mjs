import assert from 'node:assert/strict';
import {isStandaloneAnswer} from '../../src/main/xiaozhi-agent/tasks/conversation-intent.ts';

const answers=['你好！','什么是等值分数？','为什么会有四季','请解释小数的计数单位','1+1 等于几？',
    'What is a polynomial?','一元一次方程和一元二次方程有什么区别？'];
const tasks=['继续','好的','改成八年级讲义','能不能从题库里挑三道题？','请把这份试卷导出','请制作一份五年级讲义',
    '为什么之前的课件打不开？','什么是等值分数？并给我一份练习','/skill:teaching-office 什么是等值分数？',
    '请解释这道题目','请解释分数\n再保存到文件','什么是这个文件中的附件？'];
for(const prompt of answers)assert(isStandaloneAnswer({prompt}),prompt);
for(const prompt of tasks)assert(!isStandaloneAnswer({prompt}),prompt);
const prompt=answers[1];
for(const options of [{attachments:[{id:'attachment',revision:1}]},{presentation:{}},{continueTask:{}},{classroomPlan:{}},
    {paperExportIntent:{}},{resumeDeliveryId:'delivery-id'}])assert(!isStandaloneAnswer({prompt,...options}),JSON.stringify(options));
console.log(JSON.stringify({passed:answers.length+tasks.length+6,answers:answers.length,tasks:tasks.length,structuredStarts:6}));
