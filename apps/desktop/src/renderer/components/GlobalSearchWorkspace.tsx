import { FileText, Search, UserRound, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LearningRecord, SearchResult, Student } from '../../shared/contracts';

export type GlobalSearchSnapshot = {query:string;result:SearchResult|null;submittedQuery?:string;focusedId?:string};

type Props = {
  initialState?:GlobalSearchSnapshot;
  onStateChange?:(state:GlobalSearchSnapshot)=>void;
  studentNames?:Record<string,string>;
  setStatus: (message: string) => void;
  onOpenStudent: (student: Student) => void | Promise<void>;
  onOpenRecord: (record: LearningRecord) => void | Promise<void>;
};

type StateProps = {
  studentNames?:Record<string,string>;
  query: string;
  loading: boolean;
  error: string;
  result: SearchResult | null;
  onOpenStudent: Props['onOpenStudent'];
  onOpenRecord: Props['onOpenRecord'];
};

function recordTypeLabel(value: string) {
  return ({ class: '课堂', homework: '作业', exam: '试卷', mistake: '错题', communication: '沟通', summary: '阶段总结' } as Record<string, string>)[value] ?? value;
}

export function GlobalSearchState({ query, loading, error, result, onOpenStudent, onOpenRecord, studentNames = {} }: StateProps) {
  if (loading) return <div className="global-search-state" data-testid="global-search-loading">正在检索本地学生与学习记录…</div>;
  if (error) return <div className="global-search-state error-banner" data-testid="global-search-error"><XCircle size={20} /><div><strong>检索失败</strong><p>{error}</p></div></div>;
  if (!result) return <div className="global-search-state" data-testid="global-search-idle">输入学生姓名、记录标题、正文或标签开始检索。</div>;
  if (!result.students.length && !result.records.length) return <div className="global-search-state" data-testid="global-search-empty">没有找到与“{query}”匹配的本地内容。请缩短关键词后重试。</div>;
  return (
    <div className="global-search-results" data-testid="global-search-results">
      <section>
        <div className="global-search-section-heading"><UserRound size={18} /><h3>学生</h3><span>{result.students.length}</span></div>
        <div className="global-search-list">
          {result.students.map((student) => (
            <button data-testid={`global-search-student-${student.id}`} key={student.id} onClick={() => onOpenStudent(student)}>
              <strong>{student.displayName}</strong><span>{student.grade || '年级未填写'} · {student.subjects.join(' / ') || '科目未填写'}</span><p>{student.currentIssues || student.goals || '暂无补充摘要'}</p>
            </button>
          ))}
          {!result.students.length ? <div className="global-search-subempty">本关键词没有匹配学生。</div> : null}
        </div>
      </section>
      <section>
        <div className="global-search-section-heading"><FileText size={18} /><h3>学习记录</h3><span>{result.records.length}</span></div>
        <div className="global-search-list">
          {result.records.map((record) => (
            <button data-testid={`global-search-record-${record.id}`} key={record.id} onClick={() => onOpenRecord(record)}>
              <div><strong>{record.title}</strong><em>{studentNames[record.studentId] || '所属学生'} · {recordTypeLabel(record.recordType)} · {record.subject || '科目未填写'}</em></div><p>{record.content ? record.content.slice(0, 180) : '暂无正文'}</p><span>{record.tags.join(' · ') || '无标签'}</span>
            </button>
          ))}
          {!result.records.length ? <div className="global-search-subempty">本关键词没有匹配学习记录。</div> : null}
        </div>
      </section>
    </div>
  );
}

export function GlobalSearchWorkspace({ setStatus, onOpenStudent, onOpenRecord, initialState, onStateChange, studentNames }: Props) {
  const [query, setQuery] = useState(initialState?.query || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<SearchResult | null>(initialState?.result || null);

  const [submittedQuery,setSubmittedQuery]=useState(initialState?.submittedQuery || initialState?.query || '');
  const request = useRef(0), mounted = useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current++;};},[]);
  useEffect(()=>{onStateChange?.({query,result,submittedQuery,focusedId:initialState?.focusedId});},[query,result,submittedQuery,onStateChange]);
  useEffect(()=>{const id=initialState?.focusedId;if(!id)return;const frame=requestAnimationFrame(()=>{const row=document.querySelector<HTMLButtonElement>(`[data-testid="${CSS.escape(id)}"]`);row?.scrollIntoView({block:'center',behavior:'auto'});row?.focus({preventScroll:true});});return()=>cancelAnimationFrame(frame);},[]);
  function remember(id:string) {onStateChange?.({query,result,submittedQuery,focusedId:id});}
  async function runSearch() {
    const keyword = query.trim();
    if (!keyword) { setResult(null); setError('请输入至少一个检索关键词。'); return; }
    const stamp=++request.current;setLoading(true); setError('');
    try {
      if (!window.omniEdu) throw new Error('Electron preload 未连接。');
      const next = await window.omniEdu.searchAll(keyword);
      if(!mounted.current||stamp!==request.current)return;
      setSubmittedQuery(keyword);setResult(next);
      setStatus(`本地检索完成：${next.students.length} 名学生，${next.records.length} 条学习记录。`);
    } catch (searchError) {
      if(!mounted.current||stamp!==request.current)return;
      const message = searchError instanceof Error ? searchError.message : '无法读取本地检索结果。';
      setResult(null); setError(message); setStatus(`检索失败：${message}`);
    } finally { if(mounted.current&&stamp===request.current)setLoading(false); }
  }

  return (
    <section className="global-search-workspace" data-testid="global-search-workspace">
      <header>
        <div><span className="eyebrow">LOCAL SEARCH</span><h2><Search size={21} />跨学生证据检索</h2><p>一次查询本地学生档案与学习记录，不调用云端模型。</p></div>
        <form onSubmit={(event) => { event.preventDefault(); void runSearch(); }}>
          <input data-testid="global-search-input" aria-label="全局检索关键词" maxLength={200} value={query} onChange={(event) => { setQuery(event.target.value); if (error) setError(''); }} placeholder="学生姓名、记录标题、正文或标签" />
          <button className="primary-action" data-testid="global-search-submit" disabled={loading} type="submit"><Search size={16} />检索</button>
        </form>
      </header>
      <GlobalSearchState query={submittedQuery} loading={loading} error={error} result={result} studentNames={studentNames} onOpenStudent={student=>{remember(`global-search-student-${student.id}`);return onOpenStudent(student);}} onOpenRecord={record=>{remember(`global-search-record-${record.id}`);return onOpenRecord(record);}} />
      <footer data-testid="global-search-boundary">只查找本机已有的学生和学习记录。点击结果可查看所属学生及原记录。</footer>
    </section>
  );
}
