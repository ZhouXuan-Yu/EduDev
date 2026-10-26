import assert from 'node:assert/strict';
const number=value=>'一二三四'.includes(value)?'一二三四'.indexOf(value)+1:Number(value);
const week=value=>{const m=String(value).match(/第?([一二三四1-4])\s*周/);return m?number(m[1]):undefined;};
/** Independent weekly requirements, allowing tables or explicit paragraphs.
 * Summary tables cannot substitute for missing weekly work. */
export function assertWeeklyPlan(draft){
 const sections=new Map(),flat=new Map();let tables=0,rows=0;
 for(const section of draft.sections){
  const paragraphs=section.paragraphs||[],table=section.table;
  const explicit=String(section.heading).match(/第([一二三四1-4])\s*周/),sectionWeek=explicit?number(explicit[1]):undefined;
  const goalLines=paragraphs.filter(p=>/^(?:本周|周)?目标\s*[：:]/.test(p.trim())),taskLines=paragraphs.filter(p=>/^任务[一二三四五六七八九十\d]*\s*[：:]/.test(p.trim()));
  const ownerLines=paragraphs.filter(p=>/^负责人\s*[：:]/.test(p.trim()));
  for(const p of ownerLines)assert(/^[\s_＿—-]*$/.test(p.slice(p.search(/[：:]/)+1)),'Owner must remain blank');
  let goal=goalLines.length>0&&goalLines.every(p=>/[：:]\s*\S/.test(p)),task=taskLines.length>0&&taskLines.every(p=>/[：:]\s*\S/.test(p)),owner=ownerLines.length>0;
  if(table){
   const ownerIndex=table.columns.findIndex(c=>c.includes('负责人')),goalIndex=table.columns.findIndex(c=>c.includes('目标')),taskIndex=table.columns.findIndex(c=>c.includes('任务')),weekIndex=table.columns.findIndex(c=>c.includes('周'));
   tables++;rows+=table.rows.length;
   for(const row of table.rows){assert.equal(row.length,table.columns.length,'Missing table cell');if(ownerIndex>=0)assert.equal(String(row[ownerIndex]).trim(),'','Owner must remain blank');}
   if(sectionWeek!==undefined){
    if(weekIndex>=0)for(const row of table.rows)assert.equal(week(row[weekIndex]),sectionWeek,'Section/table week contradiction');
    goal=goal||goalIndex>=0&&table.rows.length>0&&table.rows.every(row=>String(row[goalIndex]).trim());
    task=task||taskIndex>=0&&table.rows.length>0&&table.rows.every(row=>String(row[taskIndex]).trim());
    owner=owner||ownerIndex>=0&&table.rows.length>0;
    // Teachers commonly use a compact key/value table inside each weekly
    // section: 项目 | 内容 | 负责人, with rows labelled 本周目标/主要任务.
    // Accept that equally valid shape, but still require non-empty goal/task
    // values and evidence that every owner cell is blank.
    const labelledRow=(pattern)=>table.rows.some(row=>pattern.test(String(row[0]).trim())&&String(row[1]).trim());
    goal=goal||labelledRow(/^(?:本周|周)?目标$/);
    task=task||labelledRow(/^主要?任务(?:[一二三四五六七八九十\d]+)?$/);
    owner=owner||ownerIndex>=0&&table.rows.length>0;
   }else if(weekIndex>=0&&goalIndex>=0&&taskIndex>=0&&ownerIndex>=0){
    for(const row of table.rows){const w=week(row[weekIndex]);assert(w,'No independently located week');assert(String(row[goalIndex]).trim()&&String(row[taskIndex]).trim(),'Empty weekly goal/task');flat.set(w,{goal:true,task:true,owner:true});}
   }
  }
  if(sectionWeek!==undefined){const prior=sections.get(sectionWeek);sections.set(sectionWeek,{goal:goal||prior?.goal,task:task||prior?.task,owner:owner||prior?.owner});}
 }
 for(const [w,part]of flat){const prior=sections.get(w);sections.set(w,{goal:part.goal||prior?.goal,task:part.task||prior?.task,owner:part.owner||prior?.owner});}
 const weeks=[...sections.keys()];assert.equal(weeks.length,4,'Exactly four independently located weeks required');assert.deepEqual([...weeks].sort(),[1,2,3,4],'Missing or duplicate week');
 for(const part of sections.values()){assert(part.goal,'Missing independently located weekly goal');assert(part.task,'Missing weekly task');assert(part.owner,'Missing weekly blank owner');}
 return{weeks,tables,rows};
}
