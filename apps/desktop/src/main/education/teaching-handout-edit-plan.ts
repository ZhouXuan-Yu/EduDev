import {createHash,randomUUID} from 'node:crypto';
import type {TeachingBookBlock,TeachingBookChapter} from '../../shared/contracts';
import {officeMathHtml} from '../../shared/office-math';
import {handoutChapterId,handoutBlockId,type HandoutEditChange,type HandoutEditDiff,type HandoutEditInput} from '../../shared/teaching-handout-edit';
import {handoutBookId,handoutDigest} from '../../shared/teaching-handout-export';
import {plainStudentInput} from '../../shared/student-context';
import type {Sql} from '../xiaozhi-agent/session-state';
import {insertTeachingBookPatch} from './teaching-book-patch-writes';
import type {TeachingBookContent} from './teaching-book-restore';

const difficulties=new Set(['基础','巩固','拓展']);
const text=(value:unknown,max:number,optional=false):value is string=>
  typeof value==='string'&&value.length<=max&&!value.includes('\0')&&(optional||!!value.trim());
const maybeText=(value:unknown,max:number,optional=false)=>value===undefined||text(value,max,optional);

export function validHandoutEditInput(raw:unknown):raw is HandoutEditInput {
  if(!plainStudentInput(raw,['bookId','digest','changes'])||!handoutBookId(raw.bookId)||!handoutDigest(raw.digest)||
    !Array.isArray(raw.changes)||raw.changes.length<1||raw.changes.length>6)return false;
  return raw.changes.every(change=>{
    if(plainStudentInput(change,['kind','chapterId','title','objectives','summary'])&&change.kind==='chapter'){
      return handoutChapterId(change.chapterId)&&maybeText(change.title,160)&&maybeText(change.summary,800,true)&&
        (change.objectives===undefined||Array.isArray(change.objectives)&&change.objectives.length>=1&&
        change.objectives.length<=6&&change.objectives.every(objective=>text(objective,240)))&&
        (change.title!==undefined||change.objectives!==undefined||change.summary!==undefined);
    }
    if(plainStudentInput(change,['kind','blockId','selectedText','replacement'])&&change.kind==='paragraph'){
      return handoutBlockId(change.blockId)&&text(change.selectedText,5000)&&text(change.replacement,5000,true);
    }
    return plainStudentInput(change,['kind','blockId','difficulty','prompt','answer','explanation'])&&change.kind==='exercise'&&
      handoutBlockId(change.blockId)&&(change.difficulty===undefined||typeof change.difficulty==='string'&&difficulties.has(change.difficulty))&&
      maybeText(change.prompt,900)&&maybeText(change.answer,400)&&maybeText(change.explanation,1000)&&
      (change.prompt===undefined||change.answer!==undefined&&change.explanation!==undefined)&&
      (change.difficulty!==undefined||change.prompt!==undefined||change.answer!==undefined||change.explanation!==undefined);
  });
}

const displayObjectives=(objectives:string[])=>objectives.join('\n');
const exerciseNumber=(block:TeachingBookBlock)=>block.title.match(/^练习 ([1-9][0-9]*) · /u)?.[1];
const exerciseRole=(block:TeachingBookBlock)=>block.metadata.handoutRole;
const blockText=(block:TeachingBookBlock)=>typeof block.payload.text==='string'?block.payload.text:undefined;
const textual=(block:TeachingBookBlock)=>block.type==='text'&&block.status==='ready'&&blockText(block)!==undefined;

export function handoutExercise(content:TeachingBookContent,block:TeachingBookBlock) {
  const number=exerciseNumber(block);
  const difficulty=block.title.slice(block.title.indexOf(' · ')+3);
  if(!number||!difficulties.has(difficulty)||exerciseRole(block)!=='exercise'||!textual(block))return;
  const peers=content.blocks.filter(item=>item.pageId===block.pageId&&exerciseNumber(item)===number&&textual(item));
  const answers=peers.filter(item=>exerciseRole(item)==='exercise_solution'&&item.title===`练习 ${number} · 答案与解析`);
  if(peers.filter(item=>exerciseRole(item)==='exercise').length!==1||answers.length!==1)return;
  const [solution]=answers;
  const raw=blockText(solution)!;
  const start=raw.indexOf('\n\n');
  if(start<1||!raw.slice(start+2).trim())return;
  return {number,difficulty,prompt:blockText(block)!,solution,answer:raw.slice(0,start),explanation:raw.slice(start+2)};
}

type BlockUpdate={previous:TeachingBookBlock;title:string;text:string;selection?:{start:number;text:string}};
type ChapterUpdate={previous:TeachingBookChapter;title:string;objectives:string[];summary:string};
type EditPlan={chapters:ChapterUpdate[];blocks:BlockUpdate[];diffs:HandoutEditDiff[]};

export function handoutEditPlan(content:TeachingBookContent,changes:HandoutEditChange[]):EditPlan {
  const plan:EditPlan={chapters:[],blocks:[],diffs:[]},targets=new Set<string>();
  const reserve=(id:string)=>{if(targets.has(id))throw Error('scope_conflict');targets.add(id);};
  const changed=(location:string,field:string,before:string,after:string,math=false)=>{
    if(before===after)return false;
    if(math)try{officeMathHtml(after);}catch{throw Error('unsupported_math');}
    plan.diffs.push({location,field,before,after});
    return true;
  };
  for(const change of changes){
    if(change.kind==='chapter'){
      const chapter=content.chapters.find(item=>item.id===change.chapterId);
      if(!chapter)throw Error('version_conflict');
      reserve(chapter.id);
      const title=change.title?.trim()??chapter.title;
      const objectives=change.objectives?.map(item=>item.trim())??chapter.learningObjectives;
      const summary=change.summary?.trim()??chapter.summary;
      const diffs=plan.diffs.length;
      changed(chapter.title,'章节标题',chapter.title,title);
      changed(chapter.title,'学习目标',displayObjectives(chapter.learningObjectives),displayObjectives(objectives),true);
      changed(chapter.title,'章节摘要',chapter.summary,summary,true);
      if(plan.diffs.length>diffs)plan.chapters.push({previous:chapter,title,objectives,summary});
      continue;
    }
    const block=content.blocks.find(item=>item.id===change.blockId);
    const page=content.pages.find(item=>item.id===block?.pageId);
    const chapter=content.chapters.find(item=>item.id===page?.chapterId);
    if(!block||!chapter||!textual(block))throw Error('version_conflict');
    reserve(block.id);
    const location=chapter.title+' / '+block.title;
    if(change.kind==='paragraph'){
      if(['exercise','exercise_solution'].includes(String(exerciseRole(block))))throw Error('exercise_unavailable');
      const before=blockText(block)!;
      const start=before.indexOf(change.selectedText);
      if(start<0||before.indexOf(change.selectedText,start+1)>=0)throw Error('selection_conflict');
      const text=before.slice(0,start)+change.replacement+before.slice(start+change.selectedText.length);
      if(!text.trim())throw Error('invalid_input');
      if(!changed(location,'正文',before,text,true))continue;
      if(JSON.stringify({...block.payload,text}).length>12_000)throw Error('invalid_input');
      plan.blocks.push({previous:block,title:block.title,text,selection:{start,text:change.selectedText}});
      continue;
    }
    const exercise=handoutExercise(content,block);
    if(!exercise)throw Error('exercise_unavailable');
    reserve(exercise.solution.id);
    const difficulty=change.difficulty??exercise.difficulty;
    const prompt=change.prompt??exercise.prompt;
    const answer=change.answer??exercise.answer;
    const explanation=change.explanation??exercise.explanation;
    if(change.answer?.includes('\n\n'))throw Error('invalid_input');
    const levelChanged=changed(location,'难度',exercise.difficulty,difficulty);
    const promptChanged=changed(location,'题干',exercise.prompt,prompt,true);
    const answerChanged=changed(location,'参考答案',exercise.answer,answer,true);
    const explanationChanged=changed(location,'解析',exercise.explanation,explanation,true);
    if(levelChanged||promptChanged)plan.blocks.push({previous:block,title:`练习 ${exercise.number} · ${difficulty}`,text:prompt});
    if(answerChanged||explanationChanged)plan.blocks.push({
      previous:exercise.solution,title:exercise.solution.title,text:answer+'\n\n'+explanation,
    });
  }
  if(!plan.diffs.length)throw Error('no_change');
  if(Buffer.byteLength(JSON.stringify(plan.diffs))>100_000)throw Error('invalid_input');
  return plan;
}

export async function writeHandoutEdits(sql:Sql,bookId:string,reviewId:string,time:string,plan:EditPlan) {
  if(!sql.change)throw Error('configuration');
  for(const edit of plan.chapters){
    const changed=await sql.change(`UPDATE teaching_book_chapters SET title=?,learning_objectives_json=?,summary=?,
      version=version+1,updated_at=? WHERE id=? AND book_id=? AND version=?`,
    [edit.title,JSON.stringify(edit.objectives),edit.summary,time,edit.previous.id,bookId,edit.previous.version]);
    if(changed!==1)throw Error('version_conflict');
  }
  for(const edit of plan.blocks){
    const {previous,selection}=edit,payload={...previous.payload,text:edit.text};
    const changed=await sql.change('UPDATE teaching_book_blocks SET title=?,payload_json=?,version=version+1,updated_at=? WHERE id=? AND page_id=? AND version=?',
      [edit.title,JSON.stringify(payload),time,previous.id,previous.pageId,previous.version]);
    if(changed!==1)throw Error('version_conflict');
    await insertTeachingBookPatch(sql,{
      id:'teaching_patch_'+randomUUID(),bookId,pageId:previous.pageId,blockId:previous.id,baseVersion:previous.version,
      resultVersion:previous.version+1,operation:selection?'replace_selection':'replace_block',
      beforeTitle:previous.title,afterTitle:edit.title,beforePayload:previous.payload,afterPayload:payload,
      reason:'对话审阅 '+reviewId,status:'applied',error:'',createdAt:time,appliedAt:time,undoneAt:'',
      selectionStart:selection?.start??0,selectionEnd:selection?selection.start+selection.text.length:0,
      selectedTextHash:selection?createHash('sha256').update(selection.text).digest('hex'):'',selectedText:selection?.text??'',
    });
  }
  await sql.run("UPDATE teaching_books SET status='draft',version=version+1,updated_at=? WHERE id=?",[time,bookId]);
}
