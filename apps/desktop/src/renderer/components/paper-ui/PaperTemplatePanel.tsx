import {Button,Input} from '@heroui/react';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperSelect} from './PaperSelect';
import {templateVersionKey,type usePaperTemplates} from './usePaperTemplates';
import type {PaperWorkspaceBasket} from './paper-basket-client';
import type {usePaperReference} from './usePaperReference';
export function PaperTemplatePanel({state,basket,reference,disabled}:{state:ReturnType<typeof usePaperTemplates>;basket:PaperWorkspaceBasket;
  reference:ReturnType<typeof usePaperReference>;disabled:boolean}) {
  const blocked=disabled||state.busy||state.retryable||basket.state!=='active';
  const sections=[...basket.blueprint.sections,...(basket.c2?.retainedSections||[]).map(r=>r.section)];
  return <DisclosureCard title="命题结构与卷面模板" data-testid="paper-template-panel">
    <p>模板版本不可变；保存不改变题篮。应用结构保留全部原题归属和分值，未安排分节或分值冲突须明确处理。</p>
    {state.message&&<p role="status" data-testid="paper-template-status">{state.message}</p>}
    {state.busy&&<Button variant="secondary" onPress={state.cancel} data-testid="paper-template-cancel">取消当前提交</Button>}
    {state.retryable&&<Button variant="secondary" isDisabled={state.busy} onPress={state.retry} data-testid="paper-template-retry">核实同一请求结果</Button>}
    <Button variant="secondary" isDisabled={blocked} onPress={()=>void state.list()} data-testid="paper-template-refresh">读取模板版本列表</Button>
    {!state.versions.length&&<p>读取后可选择已保存的确切版本；也可先提取真实参考卷再保存。</p>}
    {state.versions.map(v=><div key={templateVersionKey(v)} data-testid="paper-template-version" data-template-id={v.templateId} data-template-version={v.version}>
      <p>{v.name} · {v.kind==='structure'?'命题结构':'卷面版式'} · v{v.version}</p>
      <Button variant="secondary" isDisabled={blocked||reference.busy||reference.dirty} onPress={()=>void state.load(v)} data-testid="paper-template-edit">读取并修改此版本</Button>
    </div>)}
    {state.unavailable.map(item=><p key={item.template.templateId+':'+item.template.version} role="note" data-testid="paper-template-unavailable">
      模板 {item.template.templateId} · v{item.template.version} 不可用：{{source_changed:'来源已变化',permission_denied:'当前来源无权访问',unavailable:'版本或来源暂不可读取'}[item.reason]}。不能读取或应用。
    </p>)}
    {reference.candidate&&<section data-testid="paper-template-save-fields">
      <label>模板名称<Input aria-label="模板名称" value={state.name} maxLength={160} disabled={blocked} onChange={e=>state.setName(e.target.value)} data-testid="paper-template-name"/></label>
      <p>请在参考卷核对面板确认所保存种类的必填字段。教师修订保留原依据，不替换来源证据。</p>
      {(['structure','layout'] as const).map(kind=><div key={kind}>
        <Button variant="secondary" isDisabled={blocked||!state.name.trim()||reference.sourceInvalid||!!state.editing} onPress={()=>state.save(kind,'new')} data-testid={'paper-template-save-'+kind}>保存{kind==='structure'?'命题结构':'卷面版式'}模板 v1</Button>
        {state.editing?.kind===kind&&<>
          <Button variant="secondary" isDisabled={blocked||!state.name.trim()||reference.sourceInvalid} onPress={()=>state.save(kind,'version')} data-testid={'paper-template-new-version-'+kind}>保存为同模板新版本</Button>
          <Button variant="secondary" isDisabled={blocked||!state.name.trim()||reference.sourceInvalid} onPress={()=>state.save(kind,'copy')} data-testid={'paper-template-copy-'+kind}>从此版本另存新模板</Button>
        </>}
      </div>)}
    </section>}
    <PaperSelect label="命题结构版本" value={state.structureKey} disabled={blocked} testId="paper-template-structure"
      options={[{id:'',label:'明确选择结构版本'},...state.versions.filter(v=>v.kind==='structure').map(v=>({id:templateVersionKey(v),label:v.name+' · v'+v.version}))]}
      onChange={state.setStructureKey}/>
    <PaperSelect label="卷面版式版本" value={state.layoutKey} disabled={blocked} testId="paper-template-layout"
      options={[{id:'',label:'明确选择版式版本'},...state.versions.filter(v=>v.kind==='layout').map(v=>({id:templateVersionKey(v),label:v.name+' · v'+v.version}))]}
      onChange={state.setLayoutKey}/>
    {state.structure?.structure?.sections.map((s,index)=>{
      const selected=state.mapping.find(m=>m.templateSectionId===s.id);
      const value=selected?selected.target.kind+':'+selected.target.sectionId:'';
      return <section key={s.id}><PaperSelect label={`${s.label} · ${s.count}题 × ${s.points}分：映射目标`} value={value} disabled={blocked} testId={'paper-template-mapping-'+index}
        options={[{id:'',label:'必须明确选择，不自动猜同名'},...sections.map(old=>({id:'existing:'+old.id,label:'现有分节：'+old.label+'（'+old.points+'分）'})),
          {id:'new:template_new_'+index,label:'创建新分节（原题不自动移入）'}]}
        onChange={value=>{const [kind,sectionId]=value.split(':');if(kind==='existing'||kind==='new'){
          const target={kind:kind as 'existing'|'new',sectionId};state.setMapping(old=>[...old.filter(m=>m.templateSectionId!==s.id),{templateSectionId:s.id,target}]);
        }else state.setMapping(old=>old.filter(m=>m.templateSectionId!==s.id));}}/>
        {basket.blueprint.mode==='hybrid'&&selected&&<label>本节 AI 题配额（沿混合来源策略明确核定）
          <Input aria-label={`${s.label}的AI题配额`} type="number" min={0} max={s.count} disabled={blocked}
            value={selected.generatedCount??(selected.target.kind==='existing'?sections.find(old=>old.id===selected.target.sectionId)?.generatedCount:'')??''}
            onChange={event=>{const value=event.target.value;state.setMapping(old=>old.map(m=>m.templateSectionId===s.id?{...m,generatedCount:value===''?undefined:Number(value)}:m));}}/>
        </label>}
      </section>;
    })}
    <div className="edu-paper-actions">
      <Button variant="secondary" isDisabled={blocked||reference.dirty||!state.structure||state.mapping.length!==state.structure.structure?.sections.length} onPress={()=>state.apply('structure')} data-testid="paper-template-apply-structure">仅应用结构</Button>
      <Button variant="secondary" isDisabled={blocked||reference.dirty||!state.layout} onPress={()=>state.apply('layout')} data-testid="paper-template-apply-layout">仅应用版式</Button>
      <Button variant="secondary" isDisabled={blocked||reference.dirty||!state.structure||!state.layout||state.mapping.length!==state.structure.structure?.sections.length} onPress={()=>state.apply('both')} data-testid="paper-template-apply-both">同一事务应用两者</Button>
    </div>
    <p role="note">模板应用后仍须核对题目并确认；正式输出使用同一确认快照与已选版式，不会静默使用旧版式。</p>
  </DisclosureCard>;
}
