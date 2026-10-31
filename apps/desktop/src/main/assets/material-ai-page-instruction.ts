import {MATERIAL_PAGE_PROMPT,MATERIAL_QUESTION_PAGE_PROMPT,type AiPagePrompt,type AiPageResponse} from '../../shared/material-ai-page';
import {aiTextSignature} from '../../shared/material-ai-image';

/** Bounded codes computed from the immutable first response; never a rewritten model receipt. */
export function pageProjectionReview(first:AiPageResponse){
 return{policy:'literal-source-coverage.v1',questions:first.questions.map(q=>({number:q.number,fields:(['choices','subquestions','tables','formulas'] as const).filter(k=>q.projection[k].state==='provided'&&!aiTextSignature(q.stem).includes(aiTextSignature(q.projection[k].text)))})).filter(q=>q.fields.length)};
}
const literalProjectionInstruction=`
[原题覆盖证据 literal-source-coverage.v1]
projection.choices/subquestions/tables/formulas只记录原题已经印出的内容，绝不是解题步骤。原题没印出W=Pt、p=F/S、mg等公式时，formulas必须not_applicable，不把求解时需要的公式填进去；这些推导只写analysis。原题实际印出的公式、数值、单位仍须完整保留，不能因为不是标准公式而省略。
provided的text必须是完整stem内的一段连续原文，保持原标点、括号、选项标签与顺序。多个位置分散的选项/小问/公式，用从第一处到最后一处的完整连续原文（包括中间题干）覆盖；必要时可用完整stem。不能提炼成“A甲；B乙”或只列数值、选项、公式清单。例如stem“(1)选涂“A响度”或“B音调”；(2)选涂“A运动”或“B静止”。”，choices.text应原样复制这段完整原文，不能写“A响度；B音调；A运动；B静止”。statement.text仍严格等于完整stem。
用户消息localReview是本地对首稿覆盖字段的检查代码，只用于指出哪些字段不是原题连续原文，不代表该题答案正确或原图没有公式。第二遍必须重新看原图修正这些字段，不能照抄已知错误；首稿正确的原文及答案不得为了与提示一致而改写。根JSON结构保持原schema，不输出localReview或自定义字段。
pageText保留页眉页脚和续题原文，题目stem不包含独立页码“第N页共M页”。页首只有(2)、②等小问而没有原大题号时，不得把小问编号当新题号，也不猜测父题号；续题文字保留在pageText并标cross_page等待完整来源。`;

/** Frozen by each new page input. Legacy saved first passes keep the previous prompt. */
export function pageRestorationInstruction(imageInstruction:string,policy:AiPagePrompt['policy']=MATERIAL_PAGE_PROMPT){return imageInstruction+`\n[原页还原规则 ${policy}]
用户消息pageContext.ocrStatus是本次已保存的本地识别事实：complete表示识别成功但不保证内容正确，blank表示本地判空，failed表示识别失败，needs_review表示本地识别有疑点。不能把成功OCR说成失败，也不能把失败或空白OCR当作原图无内容的证明；OCR跨栏混排或错字必须依原图纠正。原图仍有模糊、遮挡或无法确定的字、数、公式时如实保留疑点。
先完整转录原页，再抽取和解题。多栏按原版面逐栏从上到下阅读，表头跨栏时先保留表头，不能逐行横穿不同题目。pageText保留可读的完整章节/试卷标题、说明、题号、出处括号、年份、难度星级、题面、选项、小问、表格单位和原答案解析。不要纠正原书中的日期、数值或内容事实；不要按常识改写。页眉页脚、宣传角标与正文分开，不把它们塞入邻题条件。
每题以独立的“第N题 ”开始，随后是完整原题文字及原选项、小问；不要把原题号也写入stem。题号后属于该题的出处、年份、难度标记须在pageText和stem中都完整保留，不能一遍省略、一遍补回。stem及projection.statement.text必须与pageText中该题的完整题干一致；题目出处不是可以省略的摘要。stem必须包含本题全部A/B/C/D等原选项、全部小问和原表格，不能只把它们放在projection.choices/subquestions/tables中而从stem省掉。例如选择题stem应为“[原出处]原题条件及所问\nA.原选项A\nB.原选项B\nC.原选项C\nD.原选项D”，projection.statement.text与这个完整stem相同，projection.choices.text再原样列出这些选项；小问、表格、公式同理。projection各项是从完整原题中原样摘录的覆盖证据，不是额外存放被stem遗漏内容的地方。禁止从上一遍稿复制缺漏，若第一遍确实有错，第二遍应纠错并保留真实分歧。
pageText是原文转录，不含新推导的答案或解析。原图有表格时保留完整行列、数值、单位；有图时保留可见标注，但不要把凭图解题的推断冒充图中文字。图题仍按现规则requiresImage=true，不能为了自动定稿把图形改成不需要图。
pageIssues只表达整页原文转录的真实缺口；不会解某道题、存在清晰图形、没有原答案解析、缺分类字段都不自动等于整页OCR不确定。逐题缺口仍写对应questions[].issues。无法读清仍必须标uncertain_ocr/incomplete_question等适用问题，不以流畅改写掩盖。原答案缺失时可可靠推导的答案和解析标ai_generated，不能倒灌pageText或标source。
封面、版权页、纯目录、广告页只转录可读内容，questions为空并输出no_questions；宣传缩略例题不抽取。混合页保留实际习题，不按首尾页码丢题。第二遍重新对照原图核对整页原文、题号及各题字段，正确原文保持，错误照实纠正；两遍一致不是数学正确性证明。
根对象严格只有schemaVersion/outcome/questions/pageText/pageIssues五个字段，使用前述原页schema，不增加状态、置信度、教师确认或自定义字段。`+(policy===MATERIAL_QUESTION_PAGE_PROMPT?literalProjectionInstruction:'');
}
