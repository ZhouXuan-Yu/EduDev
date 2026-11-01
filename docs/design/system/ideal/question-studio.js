/* Routing and events only. Views, dialogs, state and export have separate modules. */
(function (D) {
  const S = D.studio;
  const root = () => D.$('#content');
  S.go = view => {
    S.captureScroll();
    history.pushState(null,'','#page=teaching&tab=组卷&studio='+view);
    S.render();
  };
  S.captureScroll = () => {
    const list = D.$('#studio-results');
    if (list) { S.state.bankScroll = list.scrollTop; S.save(); }
  };
  S.render = () => {
    const view = new URLSearchParams(location.hash.slice(1)).get('studio') || 'bank';
    S.view = ['bank','edit','preview','saved','templates'].includes(view) ? view : 'bank';
    D.$('#page-title').textContent = '出题与组卷';
    root().innerHTML = S.shell(S.views[S.view]());
    bind();
    if (S.view === 'bank') D.$('#studio-results').scrollTop = S.state.bankScroll;
  };
  function bind() {
    D.all('[data-studio-view]',root()).forEach(b=>b.onclick=()=>S.go(b.dataset.studioView));
    D.$('#studio-exit').onclick=()=>{S.captureScroll();D.state.teachingTab='教学文件';D.navigate('teaching');};
    D.all('[data-studio-dialog]',root()).forEach(b=>b.onclick=()=>S.dialogs[b.dataset.studioDialog]());
    D.all('[data-filter]',root()).forEach(el=>el.onchange=()=>{S.state.filter[el.dataset.filter]=el.value;S.state.bankScroll=0;S.save();S.render();});
    D.all('[data-point]',root()).forEach(b=>b.onclick=()=>{S.state.filter.point=b.dataset.point;S.state.bankScroll=0;S.save();S.render();});
    D.all('[data-tree]',root()).forEach(b=>b.onclick=()=>{S.state.filter.tree=b.dataset.tree;S.save();S.render();});
    D.$('#studio-search-form')?.addEventListener('submit',e=>{e.preventDefault();S.state.filter.query=D.$('#studio-query').value;S.state.bankScroll=0;S.save();S.render();});
    D.$('#studio-clear')?.addEventListener('click',()=>{Object.assign(S.state.filter,{query:'',point:'全部',type:'全部',level:'全部'});S.save();S.render();});
    D.all('[data-add]',root()).forEach(b=>b.onclick=()=>{S.captureScroll();S.add(S.bank.find(q=>q.id===b.dataset.add));S.render();D.$('[data-add="'+b.dataset.add+'"]')?.focus();});
    D.all('[data-remove]',root()).forEach(b=>b.onclick=()=>{S.captureScroll();S.state.draft.items=S.state.draft.items.filter(q=>q.id!==b.dataset.remove);S.save();S.render();});
    D.all('[data-move]',root()).forEach(b=>b.onclick=()=>{const items=S.state.draft.items;const i=items.findIndex(q=>q.id===b.dataset.id),j=i+Number(b.dataset.move);if(j>=0&&j<items.length){[items[i],items[j]]=[items[j],items[i]];S.save();S.render();}});
    D.all('[data-edit]',root()).forEach(b=>b.onclick=()=>S.dialogs.edit(b.dataset.edit));
    D.all('[data-adapt]',root()).forEach(b=>b.onclick=()=>S.dialogs.adapt(b.dataset.adapt));
    D.all('[data-similar]',root()).forEach(b=>b.onclick=()=>{const q=S.bank.find(q=>q.id===b.dataset.similar);Object.assign(S.state.filter,{query:'',point:q.point,type:'全部',level:'全部'});S.save();S.go('bank');D.toast('已筛选同知识点题目，请比较题型与考法。');});
    D.all('[data-replace]',root()).forEach(b=>b.onclick=()=>S.dialogs.replace(b.dataset.replace));
    D.all('[data-score]',root()).forEach(el=>el.onchange=()=>{const n=Number(el.value);if(Number.isFinite(n)&&n>0&&n<=100)S.state.draft.items.find(q=>q.id===el.dataset.score).points=n;else D.toast('分值应大于0，且不超过100。');S.save();S.render();});
    D.$('#studio-title')?.addEventListener('change',e=>{S.state.draft.title=e.target.value.trim()||'未命名练习';S.save();S.render();});
    D.$('#studio-purpose')?.addEventListener('change',e=>{S.state.draft.purpose=e.target.value;S.save();S.render();});
    D.$('#studio-layout')?.addEventListener('change',e=>{S.state.draft.layout=e.target.value;S.save();S.render();});
    D.all('[data-preview-kind]',root()).forEach(b=>b.onclick=()=>{S.state.preview=b.dataset.previewKind;S.save();S.render();});
    D.$('#studio-download')?.addEventListener('click',S.output.download);
    D.$('#studio-print')?.addEventListener('click',S.output.print);
    D.$('#studio-backup')?.addEventListener('click',S.output.backup);
    D.$('#studio-save')?.addEventListener('click',()=>{S.archive();D.toast('已保存到当前浏览器的原型草稿。');});
    D.$('#studio-new')?.addEventListener('click',()=>{S.archive();S.state.draft=S.fresh();S.save();S.go('bank');});
    D.all('[data-resume]',root()).forEach(b=>b.onclick=()=>{const chosen=structuredClone(S.state.saved.find(d=>d.id===b.dataset.resume));S.archive();S.state.draft=chosen;S.save();S.go('edit');});
    D.all('[data-template]',root()).forEach(b=>b.onclick=()=>S.dialogs.template(S.state.templates.find(t=>t.id===b.dataset.template)));
  }
  D.paper = {render:S.render};
  window.addEventListener('beforeunload',S.captureScroll);
})(window.Design);
