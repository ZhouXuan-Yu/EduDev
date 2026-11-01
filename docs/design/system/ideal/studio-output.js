/* Same draft snapshot supplies screen preview, printable page and downloaded HTML. */
(function(D){
  const S=D.studio,e=D.escape;
  function documentHTML(){
    const d=S.state.draft,teacher=S.state.preview==='teacher',exam=d.purpose==='exam';
    return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${e(d.title)}</title><style>
      *{box-sizing:border-box}body{margin:0;background:#e9ebee;color:#222;font:16px/1.85 'Microsoft YaHei',sans-serif}.sheet{max-width:210mm;min-height:297mm;background:white;margin:24px auto;padding:20mm 18mm}h1{text-align:center;font-size:24px;margin:0 0 8px}.meta{text-align:center;font-size:13px;color:#666}.name{border-bottom:1px solid #bbb;padding:18px 0;margin-bottom:18px}.questions{${d.layout.includes('双栏')?'column-count:2;column-gap:28px;':''}}article{break-inside:avoid;padding:16px 0;border-bottom:1px solid #eee}ol{padding-left:25px}li{margin:6px 0}.qs-question-text{white-space:normal}.qs-figure{margin:12px 0}.qs-figure svg{width:100%;max-width:330px;height:auto}.qs-figure figcaption{font-size:11px;color:#777}.answer{padding:10px;background:#f5f6f8;font-size:14px}.space{height:64px}footer{font-size:11px;color:#777;margin-top:25px}small{color:#777}@page{size:A4;margin:16mm}@media print{body{background:white}.sheet{margin:0;padding:0;min-height:0;max-width:none}article{break-inside:avoid}}@media(max-width:600px){.sheet{padding:24px;margin:0}.questions{column-count:1}}
      </style><main class="sheet"><h1>${e(d.title)}</h1><div class="meta">${teacher?'教师版 · 含答案解析':'学生版'}${exam?' · 共 '+d.items.reduce((n,q)=>n+q.points,0)+' 分':''}</div>${exam?'<div class="name">班级：________　姓名：________　学号：________</div>':'<div class="name">姓名：________　日期：________</div>'}<div class="questions">${d.items.map((q,i)=>`<article><strong>${i+1}. ${exam?'（'+q.points+'分）':''}</strong>${S.questionBody(q)}${teacher?`<div class="answer"><strong>答案：${e(q.answer||'待补充')}</strong><p>${e(q.analysis||'待补充解析')}</p><small>来源：${e(q.source||q.kind)}</small></div>`:q.type==='计算题'||q.type==='实验题'?'<div class="space"></div>':''}</article>`).join('')}</div><footer>小智 · 原型示例题组，非正式教学产物${d.items.some(q=>!q.reviewed)?' · 含待核对内容':''}</footer></main></html>`;
  }
  function downloadFile(content,name,type){
    const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');
    a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  const ready=()=>S.state.draft.items.length>0&&S.state.draft.items.every(q=>q.reviewed);
  S.output={document:documentHTML,
    download(){if(!ready())return D.toast('请先核对题目。');const name=S.state.draft.title.replace(/[<>:"/\\|?*]/g,'-');downloadFile(documentHTML(),name+'-'+(S.state.preview==='teacher'?'教师版':'学生版')+'.html','text/html;charset=utf-8');},
    print(){if(!ready())return;D.$('#studio-paper-frame').contentWindow.print();},
    backup(){downloadFile(JSON.stringify(S.state,null,2),'小智-原型题组备份.json','application/json');}
  };
})(window.Design);
