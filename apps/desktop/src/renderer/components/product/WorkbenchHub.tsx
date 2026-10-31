import type { ReactNode } from 'react';
import {
  ArrowUpRight, BookOpen, ChartNoAxesCombined, ClipboardList, FileQuestion,
  Files, History, ListChecks, NotebookPen, Plus, Search, Upload, Users,
  type LucideIcon,
} from 'lucide-react';
import { useDesktopNavigation } from '../desktop/DesktopFrame';
import '../../ui-system/workbench-pages.css';

type HubEntry = { view: string; title: string; description: string; icon: LucideIcon };

const teachingEntries: readonly HubEntry[] = [
  { view: 'notebook', title: '备课本', description: '整理教学思路与备课内容', icon: NotebookPen },
  { view: 'book', title: '讲义', description: '组织章节与课堂讲义', icon: BookOpen },
  { view: 'question_notebook', title: '题本', description: '检索、核对与整理题目', icon: FileQuestion },
  { view: 'paper', title: '组卷', description: '按教学要求选题组卷', icon: ClipboardList },
  { view: 'artifacts', title: '教学文件', description: '查看与继续编辑教学文件', icon: Files },
];

const studentEntries: readonly HubEntry[] = [
  { view: 'students', title: '学生档案', description: '查看学生资料与教师记录', icon: Users },
  { view: 'search', title: '查找记录', description: '按姓名或关键词定位记录', icon: Search },
  { view: 'intake', title: '添加学习记录', description: '录入错题图片与教学观察', icon: Upload },
  { view: 'mistakes', title: '错题与练习', description: '核对错题与针对性练习', icon: FileQuestion },
  { view: 'mastery', title: '学习计划', description: '依据已有记录安排练习', icon: ListChecks },
  { view: 'review', title: '学习复盘', description: '回顾学习反馈与教师备注', icon: History },
  { view: 'analytics', title: '学情分析', description: '查看已有学习记录与变化', icon: ChartNoAxesCombined },
];

/** Navigation and presentation only; existing domain pages remain owned by the host. */
export function WorkbenchHub({ kind, children }: { kind: 'teaching' | 'students'; children: ReactNode }) {
  const { navigate, target } = useDesktopNavigation();
  const teaching = kind === 'teaching';
  const title = teaching ? '教学工作台' : '学生工作台';
  const entries = teaching ? teachingEntries : studentEntries;

  return (
    <section className="wb-hub" aria-label={title} data-testid={`workbench-hub-${kind}`}>
      <header className="wb-hub-heading">
        <div className="wb-hub-heading-copy">
          <h1 className="wb-hub-title">{title}</h1>
          <p className="wb-hub-description">
            {teaching ? '从备课到组卷，整理你的教学内容与文件。' : '围绕已有学习记录，了解学生并安排下一步教学。'}
          </p>
        </div>
        <button
          type="button"
          className="wb-hub-primary"
          data-testid={`hub-primary-${kind}`}
          onClick={() => navigate({ view: teaching ? 'notebook' : 'students' })}
        >
          <Plus size={18} aria-hidden="true" />
          {teaching ? '新建备课' : '添加学生'}
        </button>
      </header>

      <nav className="wb-hub-entries" aria-label={`${title}入口`}>
        {entries.map(({ view, title: entryTitle, description, icon: Icon }) => (
          <button
            key={view}
            type="button"
            className="wb-hub-entry"
            data-testid={`hub-entry-${view}`}
            aria-current={target.view === view ? 'page' : undefined}
            onClick={() => navigate({ view })}
          >
            <Icon className="wb-hub-entry-icon" size={22} strokeWidth={1.7} aria-hidden="true" />
            <span className="wb-hub-entry-copy">
              <span className="wb-hub-entry-title">{entryTitle}</span>
              <span className="wb-hub-entry-description">{description}</span>
            </span>
            <ArrowUpRight className="wb-hub-entry-arrow" size={16} aria-hidden="true" />
          </button>
        ))}
      </nav>

      <div className="wb-hub-content">{children}</div>
    </section>
  );
}
