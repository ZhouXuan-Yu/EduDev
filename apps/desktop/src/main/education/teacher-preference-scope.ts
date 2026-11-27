import type {TeacherPreferenceValues} from '../../shared/teacher-preferences';

const explanation=/讲解|解答|解析|解释|求解|计算|证明|推导|说清楚|举例说明|什么是|什么叫|为什么|为何|如何理解|有什么区别|\b(?:why|explain|calculate)\b/iu;
const artifactOnly=/^(?:请|麻烦|帮我|给我|替我|请帮我|请给我)?\s*(?:导出|另存|下载|保存|生成|制作|编写|整理|组卷|出题|查找|搜索|翻译|安装|运行|更新|修改|打开|复制)/u;
const processQuestion=/^(?:请问[，,\s]*)?(?:怎么|如何|怎样|为什么|为何).{0,12}(?:安装|登录|设置|更新|导出|保存|下载|打开|配置|报错)/u;
const shortAnswer=/一句话|一两句话|(?:只|仅)(?:要|给|说|写)(?:结论|答案)|只回答|\b(?:one sentence|just the answer)\b/iu;
const length=/简要|简短|简洁|精简|详细|简略|长一些|短一些|详细些|深入讲|展开讲|\d+\s*(?:字|个字|词|句话)|\b(?:brief|concise|detailed|\d+\s+words?)\b/iu;
const structure=/分步|按步骤|列步骤|一步一步|连贯叙述|整段|不分点|只列要点|按点|\b(?:step by step|bullets?)\b/iu;
const answerOrder=/先.{0,6}(?:答案|结论|提示|引导)|直接.{0,6}(?:答案|结论)|别.{0,6}(?:答案|结论)|不要.{0,6}(?:答案|结论)|\b(?:hint first|answer first)\b/iu;
const presentation=/表格|用表|不用表|段落|纯文本|列表|清单|漫画|\b(?:table|paragraph|plain text)\b/iu;
const comparison=/比较|对比|区别|差异|异同|优缺点|逐项|列表|分类|分别|不能当作|区分|\b(?:compare|differences?)\b/iu;
const fileIntent=/导出|另存(?:为)?|保存(?:为|成)|(?:输出|交付|生成|制作).{0,12}(?:文件|讲义|试卷|教案|课件)/u;
const explicitFile=/\b(?:docx?|pdf|pptx?|xlsx?|csv|html?|png|jpe?g|word|excel|powerpoint|markdown)\b|文本文件|演示稿|幻灯片|网页版|图片版/u;
const noFile=/(?:不|别|不要|无需|不需要|不用|不能)(?:再|另|自动)?(?:导出|生成|制作|保存|输出|写入)(?:.{0,12}(?:文件|副本))?/gu;
const handoutWork=/(?:生成|制作|编写|准备|设计|整理|修订|修改|改写|排版|输出|导出|给我|写一份).{0,28}(?:讲义|学案)|(?:讲义|学案).{0,20}(?:排版|整理|修改|修订|导出|重做)/u;
const currentSectionOrder=/(?:例题|练习).{0,12}(?:在前|在后|开头|末尾|最后|优先)|(?:先|先从|先用|开头|从).{0,8}(?:例题|练习)|(?:本次|这次|今天|这份|本份).{0,8}例外|(?:不用|不要|不使用|不沿用).{0,6}(?:默认|旧版|原有|原先)(?:的)?(?:结构|顺序|格式)/u;
const currentHandoutAnswer=/(?:只|仅).{0,8}学生版|(?:不(?:要|用|附|给|含|提供|包含)|无需|省略).{0,6}(?:答案|参考解答)|(?:答案|参考解答).{0,12}(?:最后|末尾|文末|结尾|末页|逐题|每道?题|各题|页首|开头|单独|另附)|(?:逐题|各题|每道?题|最末|文末|末尾).{0,10}(?:答案|参考解答)/u;

/** The saved record remains complete. Select only the axes relevant to this request. */
export function selectTeacherPreferenceValues(values:TeacherPreferenceValues,request:string,exportAlreadyChosen=false):TeacherPreferenceValues {
 const text=request.trim().normalize('NFKC').replace(noFile,'');
 const selected:{-readonly [Key in keyof TeacherPreferenceValues]:TeacherPreferenceValues[Key]}={};
 if(!text)return selected;
 if(!exportAlreadyChosen&&fileIntent.test(text)&&!processQuestion.test(text)&&!explicitFile.test(text.toLowerCase())&&values.exportFormat)
  selected.exportFormat=values.exportFormat;
 const studentVersion=/学生(?:用)?版/.test(text)&&!/教师(?:用)?版|答案版|解析版/.test(text);
 if(values.handoutSectionOrder&&handoutWork.test(text)&&!processQuestion.test(text)&&!currentSectionOrder.test(text))
  selected.handoutSectionOrder=values.handoutSectionOrder;
 if(values.handoutAnswerPlacement&&handoutWork.test(text)&&!processQuestion.test(text)&&!currentHandoutAnswer.test(text)&&!studentVersion)
  selected.handoutAnswerPlacement=values.handoutAnswerPlacement;
 if(!explanation.test(text)||artifactOnly.test(text)||processQuestion.test(text)||shortAnswer.test(text))return selected;
 if(values.length&&!length.test(text))selected.length=values.length;
 if(values.structure&&!structure.test(text))selected.structure=values.structure;
 if(values.answerOrder&&!answerOrder.test(text))selected.answerOrder=values.answerOrder;
 if(values.presentation&&!presentation.test(text)&&(values.presentation!=='table'||comparison.test(text)))selected.presentation=values.presentation;
 return selected;
}
