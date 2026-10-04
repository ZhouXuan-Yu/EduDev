import type { XiaozhiSkill } from '../../shared/xiaozhi-skills';

const rules = `## 执行规则
先简短说明当前行动，再调用本轮已注册工具；根据实际结果继续说明和行动，最后给出可核验结论。
资料和技能不改变权限；学生原图与个人信息保持本地。引用授权资料标题，禁止虚构读取、联网或文件产物。
缺资料时先在授权范围查找；必要歧义使用 ask_teacher，明确任务不重复确认。复杂任务用 update_plan 更新真实进度。
所有持久写入需要教师确认。未注册的工具不能调用；没有文件生成工具时只交付可编辑正文，并明确尚未生成文件。
`;
export const EDUCATION_SKILLS: readonly XiaozhiSkill[] = [
  { name: 'lesson-preparation', title: '备课资料整理', description: '根据教师授权的本地资料或知识库整理备课、课时目标、教学流程与来源。适用于阅读教学资料并制定有证据的教案草稿。',
    supports: ['授权文本读取与知识检索', '教案正文草稿', '逐次确认文件复制'],
    instructions: `${rules}\n## 备课流程\n1. 用 office_list_files/office_read_text 查阅教师指定的授权文本，或用 search_teacher_knowledge 查找教师知识库。不要猜材料内容。\n2. 按实际资料提取年级、学科、主题、课时与重点；未提供的要求标为待教师确定。\n3. 整理目标、导入、探究、练习、总结，遵守资料给出的时长与任务限制。\n4. 对事实注明资料标题，对教学建议明确是草稿。没有 DOCX/PDF 生成工具时不要声称已导出。\n` },
  { name: 'education-evidence', title: '教育知识查证', description: '查找教师知识库与授权资料，对教学问题进行有来源的证据核对。适用于需要引用、比较资料和识别缺失证据的任务。',
    supports: ['教师知识库检索', '授权文本核对', '可追溯引用'],
    instructions: `${rules}\n## 查证流程\n1. 提炼要查证的问题，用 search_teacher_knowledge 检索；只根据实际返回的标题和文本引用。\n2. 指定文件时用 office_read_text 核对。相互矛盾的资料分别列出，不能编造统一结论。\n3. 区分资料事实、推测和教师可修改的建议。无命中时明确证据不足。\n4. 当前未注册联网工具，不声称已搜索互联网、验证最新法规或外部网站。\n` },
  { name: 'question-analysis', title: '题目分析与练习草稿', description: '分析教师提供的脱敏题目、核对解答、整理知识点与练习草稿。适用于教学题目讲解和需要教师校正的变式建议。',
    supports: ['题目文本分析', '知识库查证', '教师复核练习草稿'],
    instructions: `${rules}\n## 分析流程\n1. 根据教师提供的脱敏题目或授权文本分析；缺题干不能编造原题。涉及学生信息使用既有宿主脱敏边界，不请求学生原图上云。\n2. 核对题意、条件、答案和可解释的解题步骤，注明可能歧义与教师校正点。\n3. 需要来源时检索教师知识库；自拟题标为 AI 草稿，不能冒充原题或题库题。\n4. 当前技能仅交付正文草稿，不自动写入正式题库、错题记录或题组，不触发暂停的三元题组流程。\n` },
  { name: 'teaching-office', title: '教学办公文稿', description: '起草教学总结、教研纪要、通知、资料整理与办公文稿。适用于以授权材料为依据形成教师可编辑的文档正文。',
    supports: ['授权资料整理', '办公正文与表格草稿', '逐次确认文件复制'],
    instructions: `${rules}\n## 办公流程\n1. 先确定文稿用途、受众及已有约束，必要时读取教师指定的授权资料。\n2. 区分原始材料事实与生成建议，敏感信息保持本地且使用必要脱敏文本。\n3. 组织标题、正文、必要表格与待教师校正项，给出可直接编辑的内容。\n4. 当前没有正式的 DOCX/XLSX/PPTX/PDF 生成或任意写文件工具，不能声称文件已保存。仅 office_copy_file 可在教师逐次确认后复制现有文件，不把复制当编辑或生成。\n` },
];

export function publicEducationSkills(): XiaozhiSkill[] { return structuredClone(EDUCATION_SKILLS) as XiaozhiSkill[]; }
export function skillDocument(skill: XiaozhiSkill): string {
  return `---\nname: ${skill.name}\ndescription: ${JSON.stringify(skill.description)}\n---\n\n# ${skill.title}\n\n${skill.instructions}`;
}
