import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {EDUCATION_SKILLS_V2,EDUCATION_SKILLS_V3,skillDocument}=await import('../../src/main/xiaozhi-agent/education-skills.ts');
const {createManagedEducationSkills}=await import('../../src/main/xiaozhi-agent/managed-skills.ts');
const {createPiSkillCatalogState}=await import('../../src/main/xiaozhi-agent/skill-catalog-state.ts');

const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/browser-guide-'));
let db=new DatabaseSync(path.join(output,'app.db'));
const state=createPiSkillCatalogState({
  run:async(sql,args=[])=>db.prepare(sql).run(...args),
  change:async(sql,args=[])=>Number(db.prepare(sql).run(...args).changes),
  all:async(sql,args=[])=>db.prepare(sql).all(...args),
});
try {
  const root=path.join(output,'managed');
  const manager=createManagedEducationSkills({root,state,assertIdle(){}});
  for(const [version,definitions] of [[2,EDUCATION_SKILLS_V2],[3,EDUCATION_SKILLS_V3]]){
  const fresh=await manager.initialize();
  assert((await manager.preview('education-evidence')).document.includes('matchedRef'));
  const old=definitions.find(skill=>skill.name==='education-evidence');
  const bytes=Buffer.from(skillDocument(old));
  const directory=`versions/${old.name}/${randomUUID()}/${old.name}`;
  const dest=path.join(root,directory);
  fs.mkdirSync(dest,{recursive:true});
  fs.writeFileSync(path.join(dest,'SKILL.md'),bytes);
  const legacy={name:old.name,title:old.title,description:old.description,origin:'builtin',version,
    archived:false,enabled:false,directory,files:[{relative:'SKILL.md',size:bytes.length,
      sha256:createHash('sha256').update(bytes).digest('hex')}]};
  assert(await state.saveSkillCatalog(fresh.revision,fresh.skills.map(item=>item.name===old.name?legacy:item)));
  const migrated=await manager.initialize();
  const current=migrated.skills.find(item=>item.name===old.name);
  assert.equal(current.version,4);
  assert.equal(current.enabled,false);
  assert.deepEqual(fs.readFileSync(path.join(dest,'SKILL.md')),bytes);
  assert.deepEqual(migrated.skills.filter(i=>i.name!==old.name),fresh.skills.filter(i=>i.name!==old.name));
  db.close();
  db=new DatabaseSync(path.join(output,'app.db'));
  const reopened=createManagedEducationSkills({root,state,assertIdle(){}});
  assert.deepEqual(await reopened.initialize(),migrated);
  assert((await reopened.preview(old.name)).document.includes('内置浏览器操作手册'));
  assert((await reopened.preview(old.name)).document.includes('expectText'));
  }
  console.log('PASS fresh manual, v2 and v3 upgrades, disabled setting, previous bytes, unaffected skills, reopened database');
} finally {db.close();}
