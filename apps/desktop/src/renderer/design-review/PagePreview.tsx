import { useState } from 'react';
import { Button } from '@heroui/react';
import { FileText, BookOpen, ChevronRight, Search, Plus } from 'lucide-react';
import type { PageContract } from './page-contracts';
import { ReviewPreview } from './ReviewPreview';

export function PagePreview({page}:{page:PageContract}) {
 const rows=page.id==='students'?['演示学生 A','演示学生 B','演示学生 C']:page.id==='search'?['演示学生 A · 课堂记录','演示学生 B · 方程错题','演示学生 C · 教师观察']:['一元一次方程 · 教学资料','课堂练习 · 第一课时','单元整理 · 教师笔记'];
 const [selected,setSelected]=useState(0),[query,setQuery]=useState(''),[mode,setMode]=useState('全部');
 const [notice,setNotice]=useState('');
 const action=()=>setNotice('这是版式样张；正式功能继续使用当前工作树的业务入口，不在这里写入数据。');
 if(page.layout==='review')return <ReviewPreview page={page}/>;
 if(page.layout==='settings')return <div className="review-settings">
   <aside className="review-local-nav">{['模型与连接','本地资料','资料使用范围','教育技能','备份与恢复'].map(label=><button key={label} className={mode===label||mode==='全部'&&label==='模型与连接'?'selected':''} onClick={()=>setMode(label)}>{label}</button>)}</aside>
   <div className="review-settings-body"><div className="review-section-label">模型与连接</div><h2>{mode==='全部'?'默认模型':mode}</h2><p>管理小智使用的模型。凭证只保存在本地。</p>
    <div className="review-setting-row"><div><strong>默认模型</strong><small>用于新的教学对话</small></div><span>DeepSeek</span><Button variant="secondary" onPress={action}>更改</Button></div>
    <div className="review-setting-row"><div><strong>API 凭证</strong><small>保存的凭证不会显示在页面或日志中</small></div><span>••••••••</span><Button variant="secondary" onPress={action}>管理</Button></div>
    <div className="review-setting-row"><div><strong>连接状态</strong><small>仅点击后检查；此样张不调用模型</small></div><Button variant="secondary" onPress={action}>测试连接</Button></div>
    {notice&&<p role="status" className="review-inline-notice">{notice}</p>}
   </div>
  </div>;
 if(page.layout==='form')return <div className="review-form"><div><span className="review-section-label">学习记录</span><h2>添加一条学习记录</h2><p>选择学生，然后添加错题图片或教学观察。</p></div>
   <label>所属学生<select aria-label="所属学生"><option>请选择学生（样张）</option><option>演示学生</option></select></label>
   <label>记录标题<input placeholder="例如：一元一次方程课堂练习" /></label>
   <button className="review-upload" onClick={action}><Plus size={24}/>添加图片或资料<small>原图保留在本地；识别内容由教师核对</small></button>
   <label>教师观察<textarea rows={5} placeholder="记录学生遇到的问题…" /></label><Button onPress={action}>保存记录</Button>{notice&&<p role="status">{notice}</p>}
  </div>;
 if(page.layout==='editor')return <div className="review-editor">
   <aside><span className="review-section-label">文档目录</span>{['教学目标','课堂活动','练习与反馈'].map((title,i)=><button key={title} onClick={()=>setSelected(i)} className={i===selected?'selected':''}><BookOpen size={15}/>{title}</button>)}</aside>
   <article className="review-document"><div className="review-document-meta">版式样张 · 本文可编辑 · 不保存业务数据</div><h1 contentEditable suppressContentEditableWarning>一元一次方程</h1><p className="review-document-lead">从等式的性质出发，理解每一步变形的依据。</p>
    <div contentEditable suppressContentEditableWarning className="review-editable"><h2>{['教学目标','课堂活动','练习与反馈'][selected]}</h2><p>学生能够用自己的语言解释等式两边同时进行相同运算的理由，并独立核对变形前后的等式是否成立。</p><p>用两种方法处理同一道方程，再比较步骤的异同。给学生留出说明理由和修正错误的空间。</p><h2>课堂练习</h2><p>3(2x - 1) = 15</p><p>请写出变形过程，并核对结果。</p></div>
    <footer>资料来源与教师修订记录在正式文档旁查看。</footer>
   </article>
  </div>;
 if(page.layout==='overview')return <div className="review-overview"><div className="review-section-heading"><div><h2>下一步教学安排</h2><p>先看需要处理的内容，再查看依据。</p></div><Button variant="secondary" onPress={action}>调整范围</Button></div>
   {['核对本周学习记录','整理一元一次方程错题','安排针对性练习'].map((title,i)=><div className="review-task-line" key={title}><span className="review-task-index">0{i+1}</span><div><h3>{title}</h3><p>样张任务 · 正式计划须链接已确认的学生记录</p></div><ChevronRight size={16}/></div>)}
   <div className="review-empty-chart"><BookOpen size={28}/><h3>有依据，再显示学习趋势</h3><p>此样张没有真实学生数据，不展示虚构的掌握度或折线。</p></div>{notice&&<p role="status">{notice}</p>}
  </div>;
 return <div className="review-library">
   <div className="review-library-toolbar"><div className="review-search"><Search size={16}/><input aria-label="搜索当前列表" value={query} onChange={e=>setQuery(e.target.value)} placeholder={page.id==='search'?'搜索学生或记录…':'搜索名称或内容…'}/></div><Button onPress={action}><Plus size={16}/>{page.primaryAction}</Button></div>
   <div className="review-filter-tabs">{['全部','待审核','已确认'].map(label=><button className={mode===label?'selected':''} onClick={()=>setMode(label)} key={label}>{label}</button>)}</div>
   <div className="review-library-body"><div className="review-table-wrap"><table><thead><tr>{(page.columns||['内容名称','类型','状态','更新时间']).map(c=><th key={c}>{c}</th>)}</tr></thead>
    <tbody>{rows.filter(name=>name.includes(query)).map((name,i)=><tr key={name} className={selected===i?'selected':''}><td><button onClick={()=>setSelected(i)}><FileText size={17}/>{name}</button></td><td>样张</td><td><span className="review-status">待教师审核</span></td><td>—</td></tr>)}</tbody></table>
    {!rows.some(name=>name.includes(query))&&<div className="review-empty-chart"><Search size={26}/><h3>没有找到匹配内容</h3><p>试试其它关键词，或者清除筛选条件。</p></div>}
    <p className="review-caption">样张内容，不读取真实教师或学生资料。</p></div>
    <aside className="review-file-preview"><span className="review-section-label">内容预览</span><FileText size={32}/><h2>{rows[selected]}</h2><p>原文、题目内容与来源在这里核对，列表保持可见。</p><div className="review-preview-paper"><h3>一元一次方程</h3><p>本课从等式的基本性质出发，比较去括号和先除法两种方法。</p><p>3(2x - 1) = 15</p></div><Button variant="secondary" onPress={action}>打开并核对</Button></aside>
   </div>{notice&&<p className="review-inline-notice" role="status">{notice}</p>}
 </div>;
}
