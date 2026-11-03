/** Visible teacher operations only; host calls in this module are read-only. */
import assert from 'node:assert/strict';
import {choose,disclosureTrigger} from './paper-basket-ui-driver.mjs';
import {visibleUnique} from './paper-basket-ui-locators.mjs';
import {until,jsonEqual} from './paper-export-intent-evidence.mjs';
import {assertReferenceEvidenceValues,assertReferenceFieldValue} from './paper-reference-ui.mjs';
import {candidateFields} from './paper-reference-evidence.mjs';

export async function expand(root,label){const trigger=disclosureTrigger(root,label);if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();}
export async function templatePanel(page){const root=await visibleUnique(page.getByTestId('paper-template-panel'),'Template panel');await expand(root,'命题结构与卷面模板');return root;}
export async function readTemplateList(page,target){
  const r=await page.evaluate(i=>window.omniEdu.listPaperTemplates(i),target);assert.equal(r.ok,true,'Read-only actual template list');
  const value=r.value;assert.deepEqual(Object.keys(value).sort(),['unavailable','versions']);assert(Array.isArray(value.versions)&&Array.isArray(value.unavailable));
  for(const item of value.unavailable){assert.deepEqual(Object.keys(item).sort(),['reason','template'],'Unavailable list must not expose candidate/evidence');assert(['source_changed','permission_denied','unavailable'].includes(item.reason));assert.deepEqual(Object.keys(item.template).sort(),['digest','templateId','version']);assert.match(item.template.digest,/^[a-f0-9]{64}$/);assert.equal(typeof item.template.templateId,'string');assert(Number.isSafeInteger(item.template.version)&&item.template.version>=1);assert(!value.versions.some(v=>v.templateId===item.template.templateId&&v.version===item.template.version),'Unavailable exact version cannot be advertised healthy');}
  return value;
}
export async function readTemplates(page,target){return (await readTemplateList(page,target)).versions;}
export async function confirmCandidate(page,candidate,kind){
  const panel=page.getByTestId('paper-reference-panel');
  await expand(panel.getByTestId('paper-reference-layout'),'卷面规则候选');
  for(const [fieldPath,field]of Object.entries(candidateFields(candidate))){
    const input=panel.getByTestId('paper-reference-input-'+fieldPath);
    await assertReferenceFieldValue(page,fieldPath,await visibleUnique(input,'Candidate input'),field.teacherValue??field.value??'');
    if(field.evidenceIds.length){const evidence=panel.getByTestId('paper-reference-evidence-'+fieldPath);await expand(evidence,(await evidence.locator('[data-slot="disclosure-trigger"]').innerText()).trim());
      await assertReferenceEvidenceValues(evidence,candidate.evidence.filter(e=>field.evidenceIds.includes(e.id)).map(e=>e.text));}
    const required=kind==='layout'?fieldPath.startsWith('layout.'):!fieldPath.startsWith('layout.')&&!/\.(difficulty|knowledgePoint)$/.test(fieldPath);
    if(!required)continue;
    assert((field.teacherValue??field.value??'')!=='','Required field must come from actual source or explicit teacher edit');
    const group=panel.getByTestId('paper-reference-field-'+fieldPath),box=group.getByRole('checkbox');
    assert.equal(await box.count(),1);assert.equal(await box.evaluate(n=>n.tagName==='INPUT'&&n.type==='checkbox'),true);assert.equal(await box.isDisabled(),false);
    if(!await box.isChecked())await (await visibleUnique(group.locator('[data-slot="checkbox-control"]'),'Official visible confirmation control')).click();
    assert.equal(await box.isChecked(),true);
  }
}
export async function closeCandidate(page){const p=page.getByTestId('paper-reference-panel');if(!await p.count())return;await p.getByTestId('paper-reference-cancel').click();if(await p.getByTestId('paper-reference-discard-prompt').count())await p.getByTestId('paper-reference-discard').click();await p.waitFor({state:'hidden'});}
export async function extractCandidate(page,resource,target,revision){
  await closeCandidate(page);await page.getByTestId('paper-basket-reference').click();const p=page.getByTestId('paper-reference-panel');await visibleUnique(p,'Reference panel');
  await until(async()=>!await p.getByTestId('paper-reference-search-submit').isDisabled(),'Source list ready');
  await p.getByTestId('paper-reference-search').fill(resource.original_file_name);await p.getByTestId('paper-reference-search-submit').click();
  await until(async()=>!await p.getByTestId('paper-reference-search-submit').isDisabled(),'Exact source search ready');
  await p.getByTestId('paper-reference-extract-'+resource.id).click();await visibleUnique(p.getByTestId('paper-reference-coverage'),'Real extraction');
  await until(async()=>!await p.getByTestId('paper-reference-recheck').isDisabled(),'Extraction settled');
  const result=await page.evaluate(i=>window.omniEdu.extractPaperReference(i),{schemaVersion:'xiaozhi.paper-reference.v1',...target,basketRevision:revision,requestId:'qa_observe_'+crypto.randomUUID(),resourceId:resource.id,version:resource.content_hash});
  assert.equal(result.ok,true,'Read-only independently observed candidate');return result.value;
}
export async function loadVersion(page,v){const root=await templatePanel(page);await root.getByTestId('paper-template-refresh').click();await until(async()=>!await root.getByTestId('paper-template-refresh').isDisabled(),'Template refresh settled');
  const row=root.getByTestId('paper-template-version').and(page.locator(`[data-template-id="${v.templateId}"][data-template-version="${v.version}"]`));
  await (await visibleUnique(row,'Exact immutable version row')).getByTestId('paper-template-edit').click();
  await until(async()=>!await root.getByTestId('paper-template-refresh').isDisabled(),'Exact version load settled');await visibleUnique(page.getByTestId('paper-reference-panel'),'Loaded version candidate');
}
export async function mapSections(page,version,basket,mode){
  const root=await templatePanel(page);await choose(page,root.getByTestId('paper-template-structure'),version.templateId+':'+version.version);
  const mapping=[];
  for(let i=0;i<version.structure.sections.length;i++){
    const section=version.structure.sections[i],trigger=root.getByTestId('paper-template-mapping-'+i);
    await trigger.focus();await trigger.press('Enter');const options=page.getByRole('listbox').getByRole('option');
    const ids=await options.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-option-id')));await page.keyboard.press('Escape');
    const existing=mode==='retained-existing'&&i===0?basket.c2?.retainedSections.find(r=>r.entryIds.length)?.section:basket.blueprint.sections[i];
    const id=mode!=='new'&&existing?'existing:'+existing.id:ids.find(v=>v?.startsWith('new:'));
    assert(id&&ids.includes(id),'Explicit actual offered mapping target');await choose(page,trigger,id);
    mapping.push({templateSectionId:section.id,target:{kind:id.split(':')[0],sectionId:id.slice(id.indexOf(':')+1)}});
  }
  return mapping;
}
export const persistentEntries=entries=>entries.map(entry=>{const value=structuredClone(entry);for(const key of ['availability','reviewCurrent','deliveryBlock'])delete value[key];return value;});
export function assertMembers(before,after){jsonEqual(persistentEntries(after.entries),persistentEntries(before.entries),'Template application must preserve every persistent entry field including instance/source/review');
  const originalPoints=before.c2?.entryPoints??Object.fromEntries(before.entries.map(e=>[e.entryId,before.blueprint.sections.find(s=>s.id===e.sectionId)?.points??null]));
  jsonEqual(after.c2.entryPoints,originalPoints,'Template application must preserve per-entry points');}
export async function assertDerivedStates(before,after){
  await import('../office-agent/register-source.mjs');const {paperSectionMatches}=await import('../../src/main/education/paper-selection.ts');
  for(const entry of after.entries){const old=before.entries.find(e=>e.entryId===entry.entryId);assert(old);assert.equal(entry.reviewCurrent,old.reviewCurrent,'Unchanged instance review retains actual reviewCurrent');assert.equal(entry.deliveryBlock,old.deliveryBlock,'Unchanged content retains actual delivery block');
    const section=after.blueprint.sections.find(s=>s.id===entry.sectionId);
    // This fixed source_only baseline has healthy original sources; only section eligibility may change.
    assert(old.availability.available||old.availability.reason==='section_mismatch','Unexpected original source failure is not ignored');
    jsonEqual(entry.availability,section&&paperSectionMatches(entry.question,after.blueprint,section)?{available:true}:{available:false,reason:'section_mismatch'},'Actual section eligibility must follow the new blueprint');
  }
}

/** Assert the actual edited blocks, including multiline text, table cells and options. */
export async function assertDisplayedRole(root,entry,role){
  const content=entry.instance?.content[role];assert(content,'Real instance role required');
  const normalize=s=>s.replace(/\s+/g,' ').trim(),text=normalize(await root.innerText());
  if(content.mode==='source'){
    const source=role==='question'?entry.question.stem:entry.question.archive?.native?.roles[role]?.text||entry.question[role];
    assert(source,'Source role has actual text');assert(text.includes(normalize(source)),'Complete original '+role+' text displayed');return;
  }
  for(const block of content.blocks){
    const values=block.type==='text'?[block.text]:block.type==='table'?block.rows.flat():['options','subquestions'].includes(block.type)?block.items.flatMap(i=>[i.label,i.text]):[];
    for(const value of values)assert(text.includes(normalize(value)),'Full edited '+role+' '+block.type+' value displayed');
    if(block.type==='formula'){const annotations=await root.locator('annotation[encoding="application/x-tex"]').allTextContents();assert(annotations.some(a=>a.trim()===block.latex.trim()),'Exact displayed formula TeX');}
    if(block.type==='sourceImage')assert(text.includes('保留原图依赖'),'Image dependency honestly displayed');
  }
}
