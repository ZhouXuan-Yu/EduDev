import {useState} from 'react';
import {Button} from '@heroui/react';
import {FileText, Image, Check, ChevronRight} from 'lucide-react';
import type {PageContract} from './page-contracts';
export function ReviewPreview({page}:{page:PageContract}) {
 const [selected,setSelected]=useState(0),[showAnswer,setShowAnswer]=useState(false);
 const paper=page.id==='paper',mistake=page.id==='mistakes';
 return <div className="review-assessment">
  <aside className="review-assessment-list">
   <span className="review-section-label">{paper?'试卷结构':mistake?'待整理错题':'题目列表'}</span>
   {paper&&<div className="review-blueprint"><strong>100 分</strong><span>七年级数学 · 中等难度</span><p>蓝图样张，分值不代表已生成试卷。</p></div>}
   {(paper?['选择题 · 30分','填空题 · 20分','解答题 · 50分']:['一元一次方程','去括号与移项','方程的应用']).map((title,i)=><button className={selected===i?'selected':''} onClick={()=>setSelected(i)} key={title}><FileText size={15}/><span>{title}</span><ChevronRight size={13}/></button>)}
  </aside>
  <article className="review-assessment-detail">
   <div className="review-assessment-status"><span className="review-status">待教师审核</span><span className="review-caption">样张内容</span></div>
   <h2>{paper?'题目与答案核对':mistake?'对照原图，校正题目':'一元一次方程'}</h2>
   {mistake&&<div className="review-original-placeholder"><Image size={25}/><p>原图对照区域</p><span>此样张不读取或上传学生图片</span></div>}
   <div className="review-question-body"><span className="review-section-label">题目内容</span><p>解方程，并说明每一步变形的依据。</p><p className="review-equation">3(2x - 1) = 15</p></div>
   <div className="review-assessment-actions"><Button variant="secondary" onPress={()=>setShowAnswer(!showAnswer)}>{showAnswer?'收起答案与解析':'核对答案与解析'}</Button><Button variant="ghost" onPress={()=>setSelected((selected+1)%3)}>下一题</Button></div>
   {showAnswer&&<div className="review-answer-preview"><Check size={17}/><div><h3>答案：x = 3</h3><p>等式两边先同时除以 3，得到 2x - 1 = 5，再依次加 1、除以 2。</p><p>来源：教学示例。正式题目在此显示原始资料和页码。</p></div></div>}
   <div className="review-teacher-check"><span className="review-section-label">教师确认前检查</span><p>核对题干、答案、来源及难度。未经确认的草稿不会显示为已交付。</p></div>
  </article>
 </div>;
}
