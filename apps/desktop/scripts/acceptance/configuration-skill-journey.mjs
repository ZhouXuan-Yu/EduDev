import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function skillConfigurationJourney(ctx){
 const {page,until,check,shot}=ctx.get(),catalog=()=>page.evaluate(()=>window.omniEdu.getXiaozhiSkills());await ctx.tab('skills');await until(()=>catalog().then(v=>v.ok),'SKILL_CATALOGUE');
 const before=(await catalog()).value;const chooser=directory=>ctx.current().app.evaluate(({dialog},p)=>{dialog.showOpenDialog=async()=>({canceled:!p,filePaths:p?[p]:[]});},directory);
 await chooser('');await page.getByTestId('pi-skill-import').click();await until(()=>page.getByTestId('pi-skill-settings-notice').innerText().then(t=>t.includes('已取消')),'CANCEL_IMPORT');assert.deepEqual((await catalog()).value,before);
 const invalid=path.join(ctx.output,'invalid-skill');fs.mkdirSync(invalid);fs.writeFileSync(path.join(invalid,'README.md'),'Not a skill.');await chooser(invalid);await page.getByTestId('pi-skill-import').click();await until(()=>page.getByTestId('pi-skill-settings-notice').innerText().then(t=>t.includes('格式')),'INVALID_SKILL');assert.deepEqual((await catalog()).value,before);check('Cancelled and invalid real local packages leave skill catalogue unchanged');
 await chooser(ctx.skillRoot);await page.getByTestId('pi-skill-import').click();await until(()=>catalog().then(v=>v.ok&&v.value.skills.some(s=>s.name==='configuration-review')),'IMPORT');
 const read=async()=>{const v=await catalog();return v.value.skills.find(s=>s.name==='configuration-review');};let skill=await read();assert.equal(skill.version,1);assert.equal(skill.enabled,false);await page.getByTestId('pi-skill-preview-configuration-review').click();await page.getByTestId('pi-skill-full-document').waitFor();assert.equal(await page.getByTestId('pi-skill-full-document').innerText(),ctx.skillDocument);await shot('skill-imported-disabled');check('Actual package imports as disabled immutable version with exact original preview');
 const toggle=page.getByTestId('pi-skill-enabled-configuration-review');await toggle.locator('[data-slot="switch-content"]').click();await until(async()=>(await read()).enabled,'ENABLE');
 await page.getByTestId('pi-skill-edit').click();const next=ctx.skillDocument+'\n教师补充：先核对实际来源，再作教学安排。\n';await page.getByTestId('pi-skill-edit-document').fill(next);await page.getByTestId('pi-skill-save-edit').click();await until(async()=>{const s=await read();return s.version===2&&!s.enabled;},'EDIT_VERSION');
 const expected=await page.evaluate(()=>window.omniEdu.previewXiaozhiSkill({name:'configuration-review'}));assert(expected.ok);assert.equal(expected.value.document,next);await shot('skill-version-two');ctx.skillVersion=2;ctx.savedSkillDocument=next;check('Editing creates disabled version two and preserves original teacher package bytes');
 await page.getByTestId('pi-skill-archive-configuration-review').click();await page.getByTestId('pi-skill-archive-confirm').getByRole('button',{name:'取消',exact:true}).click();assert.equal((await read()).archived,false);check('Archive cancellation preserves current version and visibility');
}
