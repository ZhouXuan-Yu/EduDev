import { ArrowUpRight, ChartNoAxesCombined, ClipboardList, NotebookPen } from 'lucide-react';
import '../../ui-system/workbench-home.css';

const tasks = [
  {
    id: 'notebook',
    title: '智能备课',
    description: '梳理教学思路，准备一节课的教案。',
    icon: NotebookPen,
    prompt: '我想准备一节课，请先和我确认学科、年级、课题和教学目标，再帮我整理备课思路。',
  },
  {
    id: 'paper',
    title: '智能组卷',
    description: '按知识点、题型与难度组织试卷。',
    icon: ClipboardList,
    prompt: '我想组一份试卷，请先和我确认范围、题型、分值和难度，再从可用题目中组织试卷草稿。',
  },
  {
    id: 'analytics',
    title: '学情分析',
    description: '结合已有学习记录，梳理教学重点。',
    icon: ChartNoAxesCombined,
    prompt: '我想了解学生的学习情况，请先和我确认学生及时间范围，再依据已有记录梳理需要关注的知识点。',
  },
] as const;

const suggestions = [
  '帮我设计一节初中物理「浮力」课的教学思路。',
  '我想围绕一元一次方程组一份练习，请先帮我明确组卷要求。',
  '根据我提供的错题，梳理学生容易混淆的知识点。',
  '帮我把这份教学资料整理成课堂讲义提纲。',
] as const;

/** Suggestions prepare an unsent draft; they never start a model request. */
export function WorkbenchHome({ onSuggest, headingOnly = false }: { onSuggest?: (text: string) => void; headingOnly?: boolean }) {
  return <section className="wb-start" aria-label="教学任务首页" data-testid="workbench-home">
    <header className="wb-start-heading">
      <h1>今天想完成什么教学任务？</h1>
      <p>告诉小智你的教学需求。</p>
    </header>
    {!headingOnly && <WorkbenchHomeSuggestions onSuggest={onSuggest} />}
  </section>;
}

export function WorkbenchHomeSuggestions({ onSuggest }: { onSuggest?: (text: string) => void }) {
  return <section className="wb-start-options" aria-label="教学任务建议">
    <div className="wb-start-shortcuts">
      {tasks.map(({ id, title, icon: Icon, prompt }) => <button key={id} type="button" className="wb-start-shortcut"
        data-testid={`home-task-${id}`} disabled={!onSuggest} onClick={() => onSuggest?.(prompt)}>
        <Icon size={17} aria-hidden="true" /><span>{title}</span>
      </button>)}
    </div>
    <div className="wb-start-examples" aria-label="示例提问">
      {suggestions.slice(0, 2).map((text, index) => <button key={text} type="button" className="wb-start-example"
        data-testid={`home-suggestion-${index + 1}`} disabled={!onSuggest} onClick={() => onSuggest?.(text)}>
        <span>{text}</span><ArrowUpRight size={15} aria-hidden="true" />
      </button>)}
    </div>
  </section>;
}
