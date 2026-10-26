import { useState } from 'react';
import { Button } from '@heroui/react';
import { MessageSquare, FolderOpen, BookOpen, Users, Settings, PanelRight, ChevronRight, Check } from 'lucide-react';
import { PAGE_CONTRACTS } from './page-contracts';
import { ProcessPreview } from './ProcessPreview';
import { PagePreview } from './PagePreview';

const groupIcons={工作:MessageSquare,资料:FolderOpen,教学:BookOpen,学生:Users,系统:Settings};
export function ReviewApp() {
 const [id,setId]=useState('ai'),[constraints,setConstraints]=useState(false);
 const page=PAGE_CONTRACTS.find(p=>p.id===id)!;
 return <div className="review-root" data-testid="ui-rebuild-review">
  <aside className="review-sidebar">
    <div className="review-brand"><span className="review-brand-symbol"><BookOpen size={20}/></span><strong>小智</strong><span>教师工作台</span></div>
    <p className="review-version">UI 重建 · 审阅样张</p>
    <nav aria-label="页面样张">{Object.entries(groupIcons).map(([group,Icon])=><section className="review-nav-group" key={group}><div className="review-nav-label">{group}</div>
     {PAGE_CONTRACTS.filter(p=>p.group===group).map(p=><button key={p.id} className="review-nav-item" aria-current={id===p.id?'page':undefined} data-testid={'review-nav-'+p.id} onClick={()=>setId(p.id)}>{group==='学生'?<span className="review-nav-dot"/>:<Icon size={17}/>}<span>{p.title}</span></button>)}
    </section>)}</nav>
    <div className="review-local-note"><span className="review-local-dot"/>仅本地预览 · 不连接业务数据</div>
  </aside>
  <main className="review-main">
   <header className="review-header"><div><span>{page.group}</span><ChevronRight size={14}/><strong>{page.title}</strong></div>
    <Button variant="ghost" onPress={()=>setConstraints(!constraints)}><PanelRight size={16}/>{constraints?'隐藏页面约束':'查看页面约束'}</Button>
   </header>
   <div className="review-workspace">
    <div className="review-page" data-testid={'review-page-'+page.id}>
     {page.id!=='ai'&&<div className="review-page-heading"><span className="review-section-label">教师工作台 / {page.group}</span><h1>{page.title}</h1><p>{page.purpose}</p></div>}
     {page.id==='ai'?<ProcessPreview/>:<PagePreview key={page.id} page={page}/>}
    </div>
    {constraints&&<aside className="review-constraints" data-testid="page-constraints"><div className="review-section-label">本页约束 · {page.id}</div><h2>{page.title}</h2><p>{page.purpose}</p><h3>默认行动</h3><p>{page.primaryAction}</p><h3>不可变设计规则</h3><ul>{page.constraints.map(s=><li key={s}><Check size={14}/><span>{s}</span></li>)}</ul><h3>验收路径</h3><ul>{page.acceptance.map(s=><li key={s}><span>{s}</span></li>)}</ul><p className="review-caption">这里是可讨论的视觉合同，不是已完成的业务验收。</p></aside>}
   </div>
  </main>
 </div>;
}
