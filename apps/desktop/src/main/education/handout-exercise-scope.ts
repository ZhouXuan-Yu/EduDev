import type {TeachingBookContent} from './teaching-book-restore';
import {handoutExercise} from './teaching-handout-edit-plan';

// Bind an explicit exercise-only revision to the teacher's current message.
// A malformed ordinal or duplicate exercise must never widen the proposal.
const ordinal = '[0-9零〇一二两三四五六七八九十百千]+';
const exercise = new RegExp('^(?:第\\s*('+ordinal+')\\s*(?:道|个)?\\s*(?:练习题?|题)|练习(?:题)?\\s*('+ordinal+'))','u');
const limit = /(?:只(?:需要|需)?|仅(?:需要|需)?|单独)\s*(?:修改|修订|调整|更改|替换|重写|改动?|换)\s*(?:(?:这份|本份|当前|这本)?(?:讲义|学案)(?:中|里)?的?\s*)?/gu;
const digitNames = '零一二三四五六七八九';

function ordinalValue(raw:string) {
  if (/^[1-9][0-9]*$/u.test(raw)) return raw;
  const normalized = raw.replaceAll('两','二').replaceAll('〇','零');
  if (!/^(?:[一二三四五六七八九]千)?(?:零|[一二三四五六七八九]百)?(?:零|[一二三四五六七八九]?十)?[一二三四五六七八九]?$/u.test(normalized)) return;
  let value = 0;
  let digit = 0;
  for (const character of normalized) {
    const unit = character==='千'?1000:character==='百'?100:character==='十'?10:0;
    if (unit) {
      value += (digit || 1)*unit;
      digit = 0;
    } else digit = digitNames.indexOf(character);
  }
  return value+digit>0 ? String(value+digit) : undefined;
}

// Quoted evidence can contain an old instruction. Keep a quoted ordinal itself
// usable when it directly follows the teacher's edit verb.
function instructionText(prompt:string) {
  return prompt.normalize('NFKC').replace(/《[^《》]*》|“[^“”]*”|「[^「」]*」|"[^"]*"/gu,quoted=>{
    const value=quoted.slice(1,-1).trim();
    return exercise.exec(value)?.[0]===value?value:' ';
  });
}

function ordinalList(text:string):string[] {
  const numbers:string[]=[];
  let rest=text;
  while (rest) {
    const item=exercise.exec(rest);
    const number=item&&ordinalValue(item[1]??item[2]);
    if (!item||!number) return [];
    numbers.push(number);
    rest=rest.slice(item[0].length).trimStart();
    const next=/^(?:、|和|与|及|以及)\s*(?=第|练习)/u.exec(rest);
    if (!next) {
      if (/^(?:至|到|[-~～]|[、和与及]\s*[0-9一二三四五六七八九十])/u.test(rest)) return [];
      break;
    }
    rest=rest.slice(next[0].length);
  }
  return numbers;
}

export function requestedExerciseNumbers(prompt:string):string[] | undefined {
  const text=instructionText(prompt);
  let selected:string[]|undefined;
  for (const match of text.matchAll(limit)) {
    const rest=text.slice(match.index+match[0].length).trimStart();
    if (!/^(?:第|练习)/u.test(rest)) continue;
    const prefix=text.slice(0,match.index);
    if (/(?:上次|过去|曾经|以前)\s*$/u.test(prefix)) continue;
    const numbers=ordinalList(rest);
    selected=selected===undefined?numbers:selected.filter(n=>numbers.includes(n));
  }
  return selected;
}

export function protectedExerciseNumbers(prompt:string):string[] {
  const text=instructionText(prompt);
  const protectedNumbers=new Set<string>();
  const preserve=/(?:保留|保护|(?:不要|别|勿|不再)(?:修改|改动?|动|调整|重写))\s*(?:(?:我|老师)?(?:刚刚?|已经|手工|亲自)?(?:修改|改|修订)(?:好|过)?的\s*)?/gu;
  for (const match of text.matchAll(preserve)) {
    const rest=text.slice(match.index+match[0].length).trimStart();
    if (/^(?:第|练习)/u.test(rest)) {
      const numbers=ordinalList(rest);
      if (!numbers.length) return ['*'];
      numbers.forEach(number=>protectedNumbers.add(number));
    }
  }
  const suffix=new RegExp('(?:第\\s*('+ordinal+')\\s*(?:道|个)?\\s*(?:练习题?|题)|练习(?:题)?\\s*('+ordinal+'))\\s*(?:保持(?:不变|原样)|(?:不(?:要|用)?|别)(?:改|动)|保留原样)','gu');
  for(const match of text.matchAll(suffix))protectedNumbers.add(ordinalValue(match[1]??match[2])??'*');
  return [...protectedNumbers];
}

export function protectedExerciseBlocks(content:TeachingBookContent,numbers:string[]) {
  return new Set(content.blocks.filter(block=>block.metadata.handoutRole==='exercise'&&(
    numbers.includes('*')||numbers.some(number=>block.title.startsWith('练习 '+number+' · ')))).map(block=>block.id));
}

export function currentExerciseTargets(content:TeachingBookContent,numbers:string[]):Set<string> {
  const selected=new Set<string>();
  for (const number of numbers) {
    const matches=content.blocks.filter(block=>block.metadata.handoutRole==='exercise'&&
      block.title.startsWith('练习 '+number+' · '));
    if (matches.length!==1||!handoutExercise(content,matches[0])) return new Set();
    selected.add(matches[0].id);
  }
  return selected;
}
