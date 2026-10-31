import {MATERIAL_AI_PAGE_RESPONSE,MATERIAL_AI_BOOK_PAGE_RESPONSE,MATERIAL_BOOK_PAGE_POLICY} from '../../shared/material-ai-page';

/** Only new answer units select this contract; old saved first passes keep v1. */
export function bookPageRestorationInstruction(pageInstruction:string){
 return pageInstruction.replaceAll(MATERIAL_AI_PAGE_RESPONSE,MATERIAL_AI_BOOK_PAGE_RESPONSE)
  .replaceAll('schemaVersion/outcome/questions/pageText/pageIssues五个字段','schemaVersion/outcome/questions/pageText/pageIssues/answerIssues六个字段')+`\n[独立答案册角色 ${MATERIAL_BOOK_PAGE_POLICY}]
本页只转录已知答案，不抽题、不解题、不编造题干，questions必须为空数组；每条保留完整试卷标题、原编号、答案、解析、公式、表格与单位。按原图阅读顺序逐栏，试卷标题独占一行，条目用原数字编号；不能把不同试卷相同题号合并，不能把子题号升成新题。页末未完句如实保留，不能补写下一页或加句号掩盖缺失。第二遍重新对照原图逐条检查，不为一致而保留错误。
新增answerIssues严格为数组，每项严格包含section(本页原文中完整的所属试卷标题字符串)、number(1至5位原数字题号字符串)、issues(非空且不重复的既有疑点枚举数组)，最多200项。只列确有疑点的答案条目，不能添加答案、解析、坐标、置信度或任意自定义字段。相同完整试卷+题号不能重复。章节或题号无法确定，不猜测归属。
本页中有些条目完整、有些条目跨页或不清晰时，只有能明确定位到完整试卷及唯一题号的真实局部疑点才放入answerIssues，例如页尾某题解析未完标cross_page，某题原字无法辨认标uncertain_ocr；不能因后续另一个试卷的尾题跨页，宣称前面所有清晰条目也不清晰。对同一条目有多项疑点放在同一issues数组，缺失内容不可凭常识补造。原文未附解析不自动等于OCR疑点。
pageIssues仍保留无法定位、全页模糊、试卷归属或阅读顺序不确定等真实整页疑点；不要把无法定位的问题硬塞给任意题号，也不能为了回写而清除真实疑点。有任一局部或整页疑点时outcome为needs_review，全部完整才no_questions。即使页尾不完整，也须忠实保留本页可见的全部文字，不能输出节选。
根对象严格只有schemaVersion/outcome/questions/pageText/pageIssues/answerIssues六个字段，schemaVersion为${MATERIAL_AI_BOOK_PAGE_RESPONSE}。无局部疑点时answerIssues为空数组。第一遍与第二遍都按本契约输出；此阶段不声明题册匹配成功、数学正确、自动回写成功或教师确认。`;
}
