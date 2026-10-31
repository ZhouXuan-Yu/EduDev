import { ArrowUpRight, ChartNoAxesCombined, ClipboardList, NotebookPen } from 'lucide-react';
import '../../ui-system/workbench-pages.css';

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

/** Suggestions prepare a draft through the host; the host owns explicit sending. */
export function WorkbenchHome({ onSuggest }: { onSuggest?: (text: string) => void }) {
  return (
    <section className="wb-home" aria-label="教学任务首页" data-testid="workbench-home">
      <header className="wb-home-heading">
        <h1 className="wb-home-title">今天想完成什么教学任务？</h1>
        <p className="wb-home-description">从一个教学任务开始，或选择下面的提问作为草稿。</p>
      </header>

      <div className="wb-home-tasks">
        {tasks.map(({ id, title, description, icon: Icon, prompt }) => (
          <button
            key={id}
            type="button"
            className="wb-home-task"
            data-testid={`home-task-${id}`}
            disabled={!onSuggest}
            onClick={() => onSuggest?.(prompt)}
          >
            <Icon className="wb-home-task-icon" size={26} strokeWidth={1.7} aria-hidden="true" />
            <span className="wb-home-task-title">{title}</span>
            <span className="wb-home-task-description">{description}</span>
          </button>
        ))}
      </div>

      <section className="wb-home-suggestions" aria-label="你可以这样问">
        <h2 className="wb-home-suggestions-title">你可以这样问</h2>
        <div className="wb-home-suggestion-list">
          {suggestions.map((text, index) => (
            <button
              key={text}
              type="button"
              className="wb-home-suggestion"
              data-testid={`home-suggestion-${index + 1}`}
              disabled={!onSuggest}
              onClick={() => onSuggest?.(text)}
            >
              <span className="wb-home-suggestion-text">{text}</span>
              <ArrowUpRight className="wb-home-suggestion-icon" size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
        <p className="wb-home-draft-note">选择后仅填入草稿，确认并发送后才开始处理。</p>
      </section>
    </section>
  );
}
