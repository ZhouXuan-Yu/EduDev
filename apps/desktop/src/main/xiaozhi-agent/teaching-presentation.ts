/** Presentation hints classify the current teacher request; they are not problem facts or authority. */
const grade = /(?:小学[一二三四五六1-6]年级|[一二三四五六七八九1-9]年级|初[一二三123]|高[一二三123]|小学|初中|高中)/u;
const brief = /简要|简短|简洁|精简|一句话|只要答案|brief|concise/iu;
const depth = /深入|详细|严谨|推导|证明|in.depth|detailed/iu;
export function isTeachingRestatement(text:string):boolean {
 const value=text.trim();if(/^(?:请)?(?:只要答案|只给结论|一句话说结论)[！!。\s]*$/u.test(value))return true;
 if(value.length>180||/新任务|新题|换个话题|另外|条件|数值|载荷|密度|更改答案|修改答案|[=+*/²³]/u.test(value))return false;
 // Grade and explicit length are presentation numbers; other numbers can change the problem.
 const words=value.replace(grade,'').replace(/\d+\s*(?:字|词|words?)/giu,'');
 if(/\d/u.test(words))return false;
 if(/同一题|这道题|这题|此题|上题|刚才的题|前面的题|上述题目|同一个问题/u.test(value))return /讲解|解释|说明|讲一遍|重讲|改写/u.test(value)&& (brief.test(value)||depth.test(value)||grade.test(value)||/教师|学生|老师/u.test(value));
 return /^(?:请)?(?:再|现在|然后|改成|改为|换成)?(?:用|给|面向|为)?(?:小学[一二三四五六1-6]年级|[一二三四五六七八九1-9]年级|初[一二三123]|高[一二三123]|小学|初中|高中|学生|教师|老师)(?:学生|版|的语言|能听懂的语言)?(?:再)?(?:简要|简短|简洁|详细|深入)?(?:讲解|解释|说明|讲一遍)(?:一下|一遍)?[！!。\s]*$/u.test(value)
  ||/^(?:请)?(?:再|讲得)?(?:简短|简洁|详细|深入)(?:一些|一点|些)?[！!。\s]*$/u.test(value);
}
/** Same-session original messages remain authoritative; stop at the latest substantive teacher turn. */
export function teachingReference(text:string,messages:readonly {role:string;content:string}[]):string {
 if(!isTeachingRestatement(text))return '';
 for(let i=messages.length-1;i>=0;i--){const m=messages[i];if(m.role!=='user'||isTeachingRestatement(m.content)||/^(?:继续|可以|好的|好|行|没问题|接着做|继续完成|就这样)[！!。\s]*$/u.test(m.content.trim()))continue;return m.content.slice(0,8000);}
 return '';
}
export function teachingTaskText(text:string,reference=''):string {
 return reference&&isTeachingRestatement(text)?reference+'\n'+text:text;
}
export function teachingPresentationInstructions(text:string):string {
 const audience=/(?:给|面向|为|换成|改成|改为|教师版|老师版|教师深入|教师详细|教师讲解|教师说明).{0,8}(?:教师|老师)|教师(?:版|深入|详细|讲解|说明)/u.test(text)?'教师':text.match(grade)?.[0]||(/(?:给|面向|为).{0,8}学生|学生版/u.test(text)?'学生':'');
 if(!audience&&!isTeachingRestatement(text))return '';
 return ['[本次讲解的对象与表达]',audience?`当前明确的讲解对象：${audience}。以本次请求为准，不沿用旧轮次的学段或讲法。`:'',
  brief.test(text)?'正文按本次要求简明表达，优先结论与必要方法；简短不等于少核对，不能删掉成立条件、单位或定义域。':'',
  !brief.test(text)&&depth.test(text)?'深入说明解释关键依据、适用条件及与本题直接相关的易错点；推理预算不等于正文必须变长，不增加未经核对的常数或无关扩展。':'',
  isTeachingRestatement(text)?'这轮只调整讲解方式；保留当前同题的已知条件、已核对结论及来源边界，不能把旧参考文本当新的事实或授权。若发现原结论有错，明确更正并重新核验，不为保持措辞一致而保留错误。':'',
  '只给可供教学使用的方法说明，不输出隐藏推理。'].filter(Boolean).join('\n');
}
