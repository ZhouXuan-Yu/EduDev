import { ArrowUpRight, BookOpen, Files, FileText, NotebookPen } from 'lucide-react';
import '../../ui-system/workbench-home.css';

const tasks = [
  {
    id: 'notebook',
    title: '生成教案',
    icon: NotebookPen,
    prompt: '帮我生成一份可修改的教案。先核对课题、年级和课时，再安排教学目标、课堂活动、评价与作业。',
  },
  {
    id: 'paper',
    title: '自动组卷',
    icon: FileText,
    prompt: '我想组一份试卷，请先和我确认范围、题型、分值和难度，再从可用题目中组织试卷草稿。',
  },
  {
    id: 'handout',
    title: '制作讲义',
    icon: BookOpen,
    prompt: '帮我制作一份教学讲义。先核对课题、年级和可用资料，再组织知识要点、例题、分层练习与答案。',
  },
  {
    id: 'mock-exams',
    title: '模考汇编',
    icon: Files,
    prompt: '根据我提供的资料整理上海各区模考汇编。先核对年份、学科、区和考试轮次，保留原件来源，列出缺卷或答案待核对项。',
  },
] as const;

const suggestions = [
  {label: '设计一个浮力课堂实验', prompt: '帮我设计一节初中物理「浮力」课的教学思路。'},
  {label: '从错题中梳理薄弱知识点', prompt: '根据我提供的错题，梳理学生容易混淆的知识点。'},
] as const;

/** Suggestions prepare an unsent draft; they never start a model request. */
export function WorkbenchHome({ onSuggest, headingOnly = false }: { onSuggest?: (text: string) => void; headingOnly?: boolean }) {
  return <section className="wb-start" aria-label="教学任务首页" data-testid="workbench-home">
    <header className="wb-start-heading">
      <h1>今天想完成什么教学任务？</h1>
      <p>从你的教学需求开始。</p>
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
      {suggestions.map(({label, prompt}, index) => <button key={label} type="button" className="wb-start-example"
        data-testid={`home-suggestion-${index + 1}`} disabled={!onSuggest} onClick={() => onSuggest?.(prompt)}>
        <span>{label}</span><ArrowUpRight size={15} aria-hidden="true" />
      </button>)}
      <button type="button" className="wb-start-example" data-testid="home-task-analytics" disabled={!onSuggest}
        onClick={()=>onSuggest?.('我想了解学生的学习情况，请先和我确认学生及时间范围，再依据已有记录梳理需要关注的知识点。')}>
        <span>学情分析</span><ArrowUpRight size={15} aria-hidden="true"/>
      </button>
    </div>
  </section>;
}
