/* Real browser preview/print and HTML download, synthetic question data only. */
(function(D){
 let mode='student', paperTitle='浮力单元测验';
 function documentHtml(items){
  const title={student:'学生卷',teacher:'教师答案卷',sheet:'答题卡'}[mode];
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>'+D.escape(paperTitle)+' · '+title+'</title><style>@page{size:A4;margin:20mm}body{font:16px/1.8 "Microsoft YaHei",sans-serif;color:#111;max-width:170mm;margin:20px auto}h1{text-align:center;font-size:24px}.meta{text-align:center}.question{margin:24px 0;break-inside:avoid}.blank{height:80px;border-bottom:1px dotted #bbb}.warning{padding:12px;border:1px solid #aaa;font-size:13px}@media print{body{margin:0;max-width:none}}</style><h1>'+D.escape(paperTitle)+' · '+title+'</h1><p class="meta">姓名________ 班级________ 考号________</p><p class="meta">'+items.length+'题 · '+items.reduce((n,q)=>n+q.points,0)+'分</p><p class="warning">原型演示卷，非正式教学试卷。题目为合成样例，打印前请核对内容与分页。</p>'+items.map((q,i)=>'<section class="question"><b>'+(i+1)+'. （'+q.points+'分）</b> '+(mode==='sheet'?'作答区域':D.escape(q.text))+(mode==='teacher'?'<p>参考答案：'+D.escape(q.answer||'未生成，待教师核对')+'</p>':'<div class="blank"></div>')+'</section>').join('')+'</html>';
 }
 function preview(){
  const items=D.paperSelection.snapshot();
  if(!items.length){D.toast('请先在选题工作台加入题目，再预览当前试卷。');return;}
  const modal=D.dialog('当前试卷 · 预览与导出','<p class="muted">预览来自当前题篮快照，未关联旧的演示蓝图结果；关闭后重新打开可更新。</p><label class="field">版本<select id="preview-mode"><option value="student">学生卷</option><option value="teacher">教师答案卷</option><option value="sheet">答题卡</option></select></label><iframe id="paper-live-preview" title="当前试卷卷面预览" sandbox="allow-same-origin allow-modals" style="width:100%;height:50vh;border:1px solid #ddd;background:white"></iframe><div class="detail-actions"><button class="button primary" id="paper-print-current">打印 / 另存为 PDF</button><button class="button outline" id="paper-download-current">下载 HTML 样卷</button></div><p class="notice">打印将打开浏览器打印窗口，可选择另存为PDF。Word导出、模板精确排版和自动分页校验留给正式实现，不提供虚假的成功反馈。</p>');
  modal.style.width='min(980px,calc(100vw - 32px))';
  const select=D.$('#preview-mode'),frame=D.$('#paper-live-preview');
  const update=()=>{mode=select.value;frame.srcdoc=documentHtml(items);};select.value=mode;select.onchange=update;update();
  D.$('#paper-print-current').onclick=()=>{frame.contentWindow.focus();frame.contentWindow.print();};
  D.$('#paper-download-current').onclick=()=>{const url=URL.createObjectURL(new Blob([documentHtml(items)],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='浮力测验-'+mode+'-原型样卷.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  modal.addEventListener('close',()=>{modal.style.width='';},{once:true});
 }
 D.paperPreviewOpen=title=>{paperTitle=title||'教学练习';preview();};
 const original=D.paper.render;
 D.paper.render=function(){original();const button=document.createElement('button');button.className='button primary';button.id='paper-preview-current';button.textContent='预览当前试卷 / 导出';button.onclick=preview;D.$('#question-selection').before(button);};
})(window.Design);
