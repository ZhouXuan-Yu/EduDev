import {MATERIAL_PAGE_PROMPT} from '../../shared/material-ai-page';

/** Frozen by each new page input. Legacy saved first passes keep the previous prompt. */
export function pageRestorationInstruction(imageInstruction:string){return imageInstruction+`\n[原页还原规则 ${MATERIAL_PAGE_PROMPT}]
用户消息pageContext.ocrStatus是本次已保存的本地识别事实：complete表示识别成功但不保证内容正确，blank表示本地判空，failed表示识别失败，needs_review表示本地识别有疑点。不能把成功OCR说成失败，也不能把失败或空白OCR当作原图无内容的证明；OCR跨栏混排或错字必须依原图纠正。原图仍有模糊、遮挡或无法确定的字、数、公式时如实保留疑点。
先完整转录原页，再抽取和解题。多栏按原版面逐栏从上到下阅读，表头跨栏时先保留表头，不能逐行横穿不同题目。pageText保留可读的完整章节/试卷标题、说明、题号、出处括号、年份、难度星级、题面、选项、小问、表格单位和原答案解析。不要纠正原书中的日期、数值或内容事实；不要按常识改写。页眉页脚、宣传角标与正文分开，不把它们塞入邻题条件。
每题以独立的“第N题 ”开始，随后是完整原题文字及原选项、小问；不要把原题号也写入stem。题号后属于该题的出处、年份、难度标记须在pageText和stem中都完整保留，不能一遍省略、一遍补回。stem及projection.statement.text必须与pageText中该题的完整题干一致；题目出处不是可以省略的摘要。stem必须包含本题全部A/B/C/D等原选项、全部小问和原表格，不能只把它们放在projection.choices/subquestions/tables中而从stem省掉。例如选择题stem应为“[原出处]原题条件及所问\nA.原选项A\nB.原选项B\nC.原选项C\nD.原选项D”，projection.statement.text与这个完整stem相同，projection.choices.text再原样列出这些选项；小问、表格、公式同理。projection各项是从完整原题中原样摘录的覆盖证据，不是额外存放被stem遗漏内容的地方。禁止从上一遍稿复制缺漏，若第一遍确实有错，第二遍应纠错并保留真实分歧。
pageText是原文转录，不含新推导的答案或解析。原图有表格时保留完整行列、数值、单位；有图时保留可见标注，但不要把凭图解题的推断冒充图中文字。图题仍按现规则requiresImage=true，不能为了自动定稿把图形改成不需要图。
pageIssues只表达整页原文转录的真实缺口；不会解某道题、存在清晰图形、没有原答案解析、缺分类字段都不自动等于整页OCR不确定。逐题缺口仍写对应questions[].issues。无法读清仍必须标uncertain_ocr/incomplete_question等适用问题，不以流畅改写掩盖。原答案缺失时可可靠推导的答案和解析标ai_generated，不能倒灌pageText或标source。
封面、版权页、纯目录、广告页只转录可读内容，questions为空并输出no_questions；宣传缩略例题不抽取。混合页保留实际习题，不按首尾页码丢题。第二遍重新对照原图核对整页原文、题号及各题字段，正确原文保持，错误照实纠正；两遍一致不是数学正确性证明。
根对象严格只有schemaVersion/outcome/questions/pageText/pageIssues五个字段，使用前述原页schema，不增加状态、置信度、教师确认或自定义字段。`;
}
