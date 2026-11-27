import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {HANDOUT_EDIT_SCHEMA,PROPOSE_HANDOUT_EDIT,READ_HANDOUT_EDIT,handoutChapterId,handoutBlockId,handoutEditErrors,
  handoutEditId,handoutEditParameters,handoutEditReadParameters,type HandoutEditResult,type HandoutEditReview,
  type HandoutEditSummary} from '../../shared/teaching-handout-edit';
import {handoutBookId,handoutDigest} from '../../shared/teaching-handout-export';
import {plainStudentInput} from '../../shared/student-context';
import {handoutTitleKey} from './teaching-handout-output-scope';
import {currentExerciseTargets,protectedExerciseBlocks,protectedExerciseNumbers,requestedExerciseNumbers} from './handout-exercise-scope';
import {handoutExercise,validHandoutEditInput} from './teaching-handout-edit-plan';
import {handoutEditSummary,type createTeachingHandoutEditState} from './teaching-handout-edit-state';
import type {createTeachingBookVersions} from './teaching-book-versions';
import type {HandoutOwner} from './teaching-handout-state';
import type {TeachingBookContent} from './teaching-book-restore';

export function handoutEditRequest(prompt:string) {
  const text=prompt.normalize('NFKC');
  const handout=/(?:讲义|学案)/u.test(text);
  const local=/(?:章节|第.{0,5}章|段落|知识讲解|练习\s*\d|第.{0,5}道练习|练习题)/u.test(text);
  const bounded=requestedExerciseNumbers(text)!==undefined;
  return (handout||(local||bounded)&&!/(?:试卷|组卷|教案|课堂)/u.test(text))&&
    (bounded||/(?:修改|修订|改(?:为|成|一下|写|动|题)|把.{0,80}(?:换|改|调|加|删)|换成|替换|调[低高整为成]|降低|提高|补充|重新写|删掉|重写)/su.test(text));
}

type State=ReturnType<typeof createTeachingHandoutEditState>;
type Versions=ReturnType<typeof createTeachingBookVersions>;
type Sanitize=(value:string)=>Promise<string>;
type Wait=(action:()=>Promise<boolean>)=>Promise<boolean>;
type Lease={sessionId:string;runId:string;fence:()=>void;finish:()=>void};
const sessionId=(v:unknown):v is string=>typeof v==='string'&&/^aisession_[a-f0-9-]{36}$/u.test(v);
const failure=(error:unknown)=>{
  const code=error instanceof Error&&Object.hasOwn(handoutEditErrors,error.message)?error.message:'configuration';
  return {ok:false as const,error:code,message:handoutEditErrors[code]};
};
const receipt=(data:object,success:boolean)=>({content:[{type:'text' as const,text:JSON.stringify({success,...data})}],
  details:{success},isError:!success});

async function describeChapter(content:TeachingBookContent,chapterId:string,sanitize:Sanitize,blockId?:string,allowed?:Set<string>) {
  const chapter=content.chapters.find(item=>item.id===chapterId);
  if(!chapter)throw Error('version_conflict');
  const pages=new Set(content.pages.filter(page=>page.chapterId===chapter.id).map(page=>page.id));
  const blocks=content.blocks.filter(block=>pages.has(block.pageId)&&block.status==='ready'&&
    block.type==='text'&&typeof block.payload.text==='string'&&block.metadata.handoutRole!=='exercise_solution'&&
    (!blockId||block.id===blockId)&&(!allowed||allowed.has(block.id)));
  if(blockId&&!blocks.length)throw Error('version_conflict');
  const details:{id:string;title:string;role:string;text?:string;exercise?:{difficulty:string;answer:string;explanation:string}}[]=[];
  let size=0;
  for(const block of blocks){
    const raw=String(block.payload.text);
    const exercise=handoutExercise(content,block);
    const amount=raw.length+(exercise?exercise.answer.length+exercise.explanation.length:0);
    const item={id:block.id,title:await sanitize(block.title),role:String(block.metadata.handoutRole||'text')};
    if(size+amount>20_000){details.push(item);continue;}
    size+=amount;
    details.push({...item,text:await sanitize(raw),...(exercise?{exercise:{
      difficulty:exercise.difficulty,answer:await sanitize(exercise.answer),explanation:await sanitize(exercise.explanation),
    }}:{})});
  }
  return {id:chapter.id,title:await sanitize(chapter.title),summary:allowed?'':await sanitize(chapter.summary),
    objectives:allowed?[]:await Promise.all(chapter.learningObjectives.map(sanitize)),blocks:details};
}

export function createHandoutEditCoordinator(options:{state:State;versions:Versions;
  publish:(sessionId:string,runId:string,review:HandoutEditSummary)=>void;sanitizer:()=>Promise<Sanitize>}) {
  const waits=new Map<string,Lease>();
  async function cancel(runId:string) {
    try{await options.state.interrupt(runId);}
    finally{for(const lease of waits.values())if(lease.runId===runId)lease.finish();}
  }
  async function view(raw:unknown):Promise<HandoutEditResult<HandoutEditReview>> {
    if(!plainStudentInput(raw,['schemaVersion','sessionId','id'])||raw.schemaVersion!==HANDOUT_EDIT_SCHEMA||
      !sessionId(raw.sessionId)||!handoutEditId(raw.id))return failure(Error('invalid_input'));
    try{
      const row=await options.state.view(raw.sessionId,raw.id);
      return {ok:true,value:{summary:handoutEditSummary(row),diffs:row.diffs}};
    }catch(error){return failure(error);}
  }
  async function decide(raw:unknown):Promise<HandoutEditResult<HandoutEditSummary>> {
    if(!plainStudentInput(raw,['schemaVersion','sessionId','id','fingerprint','action'])||raw.schemaVersion!==HANDOUT_EDIT_SCHEMA||
      !sessionId(raw.sessionId)||!handoutEditId(raw.id)||!handoutDigest(raw.fingerprint)||
      !['approve','reject'].includes(String(raw.action)))return failure(Error('invalid_input'));
    const lease=waits.get(raw.id);
    try{
      const row=await options.state.view(raw.sessionId,raw.id);
      if(row.fingerprint!==raw.fingerprint)throw Error('permission_denied');
      if(row.state!=='pending'){
        if(row.state==='applied'&&raw.action==='approve'||row.state==='rejected'&&raw.action==='reject')
          return {ok:true,value:handoutEditSummary(row)};
        throw Error('version_conflict');
      }
      if(!lease||lease.sessionId!==row.owner.sessionId||lease.runId!==row.owner.runId)throw Error('permission_denied');
      const next=await options.state.decide(options.versions,raw.sessionId,raw.id,raw.fingerprint,raw.action as 'approve'|'reject',lease.fence);
      const review=handoutEditSummary(next);
      try{options.publish(raw.sessionId,next.owner.runId,review);}finally{lease.finish();}
      return {ok:true,value:review};
    }catch(error){return failure(error);}
  }
  function tools(run:{prompt:string;sessionId:string;runId:string;owner:()=>HandoutOwner;current:()=>boolean},wait:Wait):ToolDefinition[] {
    const numbers=requestedExerciseNumbers(run.prompt);
    const preserved=protectedExerciseNumbers(run.prompt);
    const implicitBook=!/(?:讲义|学案|《)/u.test(run.prompt);
    const titles=[...run.prompt.matchAll(/《([^《》]+)》/gu)].map(match=>match[1]);
    let observed:{protectedBlocks:Set<string>;exerciseTargets?:Set<string>;bookId:string;digest:string;title:string;chapters:Set<string>;blocks:Set<string>}|undefined;
    const fence=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!run.current())throw Error('cancelled');};
    return [{
      name:READ_HANDOUT_EDIT,label:'读取讲义修改位置',
      description:'按讲义标题或本轮已知 bookId 读取同会话的当前讲义。多章时先返回目录，再带 chapterId 读取指定章正文、公式与练习。章节长时可加 blockId 单独读取某一个块。未提供标题时使用当前任务唯一讲义或会话唯一讲义。歧义请老师选择。',
      parameters:handoutEditReadParameters as ToolDefinition['parameters'],
      execute:async(_id,raw,signal)=>{
        try{
          fence(signal);
          if(!plainStudentInput(raw,['bookId','title','chapterId','blockId'])||raw.bookId!==undefined&&!handoutBookId(raw.bookId)||
            raw.title!==undefined&&(typeof raw.title!=='string'||!raw.title.trim()||raw.title.length>200||raw.bookId!==undefined)||
            raw.chapterId!==undefined&&!handoutChapterId(raw.chapterId)||
            raw.blockId!==undefined&&(!handoutBlockId(raw.blockId)||raw.chapterId===undefined))throw Error('invalid_input');
          if(numbers && titles.length>1)throw Error('exercise_scope');
          const target=numbers ? {title:titles[0],taskOnly:implicitBook} : {bookId:raw.bookId,title:raw.title};
          const item=await options.versions.forEdit(run.sessionId,run.owner().taskId,target);
          const sanitize=await options.sanitizer();
          fence(signal);
          if(item.kind==='ambiguous'){
            observed=undefined;
            const choices=await Promise.all(item.choices.map(async c=>({...c,title:await sanitize(c.title)})));
            fence(signal);
            return receipt({error:'ambiguous',message:handoutEditErrors.ambiguous,choices},false);
          }
          const {content,digest}=item,bookId=content.book.id,title=await sanitize(content.book.title);
          if(numbers&&(raw.bookId&&raw.bookId!==bookId||raw.title&&handoutTitleKey(raw.title)!==handoutTitleKey(content.book.title)))throw Error('exercise_scope');
          const chapters=await Promise.all(content.chapters.map(async chapter=>({id:chapter.id,title:await sanitize(chapter.title)})));
          const chapterId=raw.chapterId??(chapters.length===1?chapters[0].id:undefined);
          const targets=numbers?currentExerciseTargets(content,numbers):undefined;
          if(targets&&!targets.size)throw Error('exercise_scope');
          const chapter=chapterId?await describeChapter(content,chapterId,sanitize,raw.blockId,targets):undefined;
          fence(signal);
          if(observed?.bookId!==bookId||observed.digest!==digest)observed={bookId,digest,title,chapters:new Set(),blocks:new Set(),
            exerciseTargets:targets,protectedBlocks:protectedExerciseBlocks(content,preserved)};
          if(chapter){
            observed.chapters.add(chapter.id);
            for(const block of chapter.blocks)if(block.text!==undefined)observed.blocks.add(block.id);
          }
          return receipt({bookId,digest,title,chapters,...(chapter?{chapter}:{})},true);
        }catch(error){fence(signal);return receipt(failure(error),false);}
      },
    },{
      name:PROPOSE_HANDOUT_EDIT,label:'提交讲义改动审阅',
      description:'只基于本轮已读章节提出改动，bookId/digest须对应当前版本。chapter按chapterId可改标题、目标、摘要；paragraph按blockId提交唯一逐字选区selectedText和replacement；exercise用题干blockId，可单改difficulty，更换prompt须同时给answer和explanation。最多六项，一起等待老师审核。确认只保存待核对的讲义草稿，须另确认版本才能导出。拒绝、冲突或停止后不自动再提。',
      parameters:handoutEditParameters as ToolDefinition['parameters'],
      execute:async(callId,raw,signal)=>{
        const guard=()=>fence(signal);
        try{
          guard();
          if(!validHandoutEditInput(raw))throw Error('invalid_input');
          if(!observed||observed.bookId!==raw.bookId||observed.digest!==raw.digest)throw Error('source_required');
          const {chapters,blocks,exerciseTargets,protectedBlocks}=observed;
          if(raw.changes.some(change=>change.kind!=='chapter'&&protectedBlocks.has(change.blockId)))throw Error('exercise_scope');
          if(exerciseTargets&&raw.changes.some(change=>change.kind!=='exercise'||!exerciseTargets.has(change.blockId)))throw Error('exercise_scope');
          if(raw.changes.some(change=>change.kind==='chapter'?!chapters.has(change.chapterId):!blocks.has(change.blockId)))
            throw Error('source_required');
          const pending=await options.state.propose(options.versions,run.owner(),callId,raw,observed.title,guard);
          if(pending.state==='pending'){
            await wait(()=>new Promise<boolean>(resolve=>{
              const abort=()=>{void cancel(run.runId).catch(()=>undefined).finally(finish);};
              const finish=()=>{waits.delete(pending.id);signal?.removeEventListener('abort',abort);resolve(true);};
              waits.set(pending.id,{sessionId:run.sessionId,runId:run.runId,fence:guard,finish});
              signal?.addEventListener('abort',abort,{once:true});
              if(signal?.aborted||!run.current())abort();
              else try{options.publish(run.sessionId,run.runId,handoutEditSummary(pending));}catch{abort();}
            }));
          }
          guard();
          const result=await options.state.view(run.sessionId,pending.id),applied=result.state==='applied';
          return receipt({state:result.state,reviewId:result.id,bookId:result.input.bookId,
            ...(result.version?{versionId:result.version.id,revision:result.version.revision}:{}),
            message:applied?'老师已核对改动并保存为新草稿。请提醒老师在讲义中确认当前版本。':'建议未应用。本轮请报告实际状态，等待老师的新要求。'},applied);
        }catch(error){guard();return receipt(failure(error),false);}
      },
    }];
  }
  return {view,decide,tools,cancel};
}
