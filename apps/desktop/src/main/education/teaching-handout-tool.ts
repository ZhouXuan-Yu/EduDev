import {createHash} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {ClassroomContext} from '../../shared/classroom-context';
import {materialId} from '../../shared/materials';
import {TEACHING_HANDOUT_SCHEMA, TEACHING_HANDOUT_TOOL, teachingHandoutParameters, type TeachingHandoutInput} from '../../shared/teaching-handout';
import type {createTeachingHandoutState, HandoutOwner} from './teaching-handout-state';

export function handoutRequest(prompt:string) {
  const text = prompt.trim().normalize('NFKC');
  return /(?:讲义|学案)/u.test(text) &&
    /(?:制作|生成|编写|设计|准备|整理|创建|出一份|写一份|做一份|起草|给我.{0,16}(?:讲义|学案))/u.test(text) &&
    !/(?:如何|怎么|怎样).{0,6}(?:制作|生成|编写|设计|创建)|(?:不要|无需|不用|不必|别).{0,6}(?:制作|生成|编写|设计|准备|整理|创建|写|做|起草)/u.test(text);
}

function fields(value:unknown,keys:string):value is Record<string,unknown> {
  const required=keys.split(' ');
  return !!value && typeof value==='object' && !Array.isArray(value) &&
    Object.keys(value).length===required.length && required.every(key => Object.hasOwn(value,key));
}

function readable(value:unknown,max:number,min=1):value is string {
  return typeof value==='string' && value.length<=max && value.trim().length>=min &&
    !/[\x00-\x08\x0b\x0c\x0e-\x1f]|!\[|<\s*\/?\s*[a-z][\s\S]*?>|(?:https?|file):\/\//iu.test(value);
}

function texts(value:unknown,count:number,length:number,min=1):value is string[] {
  return Array.isArray(value) && value.length>=min && value.length<=count && value.every(item => readable(item,length));
}

export function validTeachingHandout(raw:unknown):raw is TeachingHandoutInput {
  if (!fields(raw,'schemaVersion title targetLevel chapters sourceGaps') || raw.schemaVersion!==TEACHING_HANDOUT_SCHEMA ||
      !readable(raw.title,160) || !readable(raw.targetLevel,80) || !texts(raw.sourceGaps,8,300,0) ||
      !Array.isArray(raw.chapters) || raw.chapters.length<1 || raw.chapters.length>5) return false;
  const titles=new Set<string>();
  for (const chapter of raw.chapters) {
    if (!fields(chapter,'title objectives focus difficulty explanation example exercises citations') ||
        !readable(chapter.title,160) || !texts(chapter.objectives,6,240) || !readable(chapter.focus,480) ||
        !readable(chapter.difficulty,480) || !readable(chapter.explanation,1800)) return false;
    const title=chapter.title.trim().normalize('NFKC');
    if (titles.has(title)) return false;
    titles.add(title);
    const example=chapter.example;
    if (!fields(example,'prompt steps answer') || !readable(example.prompt,900) || !texts(example.steps,8,600,2) ||
        !readable(example.answer,400) || new Set(example.steps.map(step => step.trim())).size!==example.steps.length) return false;
    if (!Array.isArray(chapter.exercises) || chapter.exercises.length<2 || chapter.exercises.length>8) return false;
    const prompts=new Set<string>(), levels=new Set<unknown>();
    for (const exercise of chapter.exercises) {
      if (!fields(exercise,'prompt difficulty answer explanation') || !readable(exercise.prompt,900) ||
          !readable(exercise.answer,400) || !readable(exercise.explanation,1000) ||
          typeof exercise.difficulty!=='string'||!['基础','巩固','拓展'].includes(exercise.difficulty)) return false;
      prompts.add(exercise.prompt.trim().normalize('NFKC'));
      levels.add(exercise.difficulty);
    }
    if (prompts.size!==chapter.exercises.length || levels.size<2) return false;
    if (!Array.isArray(chapter.citations) || chapter.citations.length>4 || !chapter.citations.length&&!raw.sourceGaps.length ||
        !chapter.citations.every(citation => fields(citation,'resourceId offset quote') && materialId(citation.resourceId) &&
          typeof citation.offset==='number' && Number.isSafeInteger(citation.offset) && citation.offset>=0 &&
          citation.offset<=10000000 && readable(citation.quote,240,4))) return false;
  }
  return JSON.stringify(raw).length<=46000;
}

const messages:Record<string,string>={
  invalid_input:'请补齐学习目标、重点难点、例题步骤和至少两个难度的独立练习。无依据的章节须说明待核对来源。',
  source_required:'先读取本轮实际使用的本地资料段落，再引用对应段落。仅检索摘要或历史引用不能作为依据。',
  source_quote_mismatch:'引用未在原段落找到，请重新读取后修正。',
  source_changed:'资料已经变化，请重新读取当前版本后再制作。',
  sensitive_content:'草稿包含需要脱敏的信息，请移除后重新提交。',
  cancelled:'本轮已停止。',
  conflict:'本轮已有一份讲义草稿，请打开已保存的草稿继续编辑。',
  permission_denied:'当前任务没有制作讲义的权限。',
  configuration:'讲义草稿暂时不能保存，请重试。',
};

export function createTeachingHandoutTool(options:{
  state:ReturnType<typeof createTeachingHandoutState>; owner:()=>HandoutOwner;
  context:()=>ClassroomContext; current:()=>boolean; sanitize:(text:string)=>Promise<string>; prompt:string;
}):ToolDefinition {
  return {
    name:TEACHING_HANDOUT_TOOL,
    label:'保存可编辑讲义草稿',
    description:'教学讲义、学生学案的可编辑草稿。先在本地资料中检索并逐段实读，再按章提交学习目标、重点、难点、知识讲解、带分步过程的例题和至少两档练习及各自答案解析。正文、题目、推导和答案里的数学表达式使用 Markdown LaTeX，例如 $3x+7=25$、$x=6$；独立公式用 $$...$$。公式定界符让讲义预览和导出使用数学排版。citations用本轮office_read_material的resourceId/offset与原句quote，引文逐字保留。缺依据用sourceGaps明示，不能编引文。无需另建文件计划或生成普通Word。提交成功后提示老师打开真实讲义编辑和核对。',
    parameters:teachingHandoutParameters as ToolDefinition['parameters'],
    execute:async(callId,raw,signal) => {
      const current=()=>options.current()&&!signal?.aborted;
      try {
        if (!current()) throw Error('cancelled');
        if (!handoutRequest(options.prompt)) throw Error('permission_denied');
        if (!validTeachingHandout(raw)) throw Error('invalid_input');
        if (/(?:根据|依据|基于|参考|使用|结合|从).{0,25}(?:资料库|知识库|本地资料|教师资料|课标|教材)/u.test(options.prompt) &&
            !raw.chapters.some(chapter => chapter.citations.length>0)) throw Error('source_required');
        const encoded=JSON.stringify(raw);
        if (await options.sanitize(encoded)!==encoded) throw Error('sensitive_content');
        const data=await options.state.save(options.owner(),callId,raw,createHash('sha256').update(encoded).digest('hex'),options.context(),current);
        const receipt={success:true,...data,status:'draft',teacherConfirmed:false,location:'教学 → 讲义'};
        return {content:[{type:'text',text:JSON.stringify(receipt)}],details:{success:true,data:receipt}};
      } catch (error) {
        const code=error instanceof Error&&Object.hasOwn(messages,error.message)?error.message:'configuration';
        return {content:[{type:'text',text:JSON.stringify({success:false,error:code,message:messages[code]})}],details:{success:false},isError:true};
      }
    },
  };
}
