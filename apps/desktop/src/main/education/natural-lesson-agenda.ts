import type {LessonPhase} from '../../shared/teaching-lesson';
import {phaseKind,phasePattern} from './lesson-agenda-revision';

export type LessonAgendaSlot={kind:LessonPhase['kind'];minutes:number};
const timedPhase=new RegExp('('+phasePattern+')(?:环节)?\\s*[:：]?\\s*([0-9]{1,3})\\s*(分钟)?(?=[\\s/,，、。；;]|$)','gu');

/** Resolve only a complete, explicitly connected agenda. Isolated duration mentions remain ordinary instructions. */
export function requestedLessonAgenda(text:string):LessonAgendaSlot[]|undefined {
 const input=text.normalize('NFKC');
 const matches=Array.from(input.matchAll(timedPhase));
 if(matches.length<4||matches.length>5||!matches.some(match=>match[3]))return;
 const slots=matches.map(match=>({kind:phaseKind(match[1])!,minutes:Number(match[2])}));
 if(slots[0].kind!=='introduction'||!slots.some(slot=>slot.kind==='activity')||!slots.some(slot=>slot.kind==='practice')||
    !['assessment','closure'].includes(slots.at(-1)!.kind)||new Set(slots.map(slot=>slot.kind)).size!==slots.length||
    slots.some(slot=>slot.minutes<1||slot.minutes>120)||slots.reduce((sum,slot)=>sum+slot.minutes,0)>240)return;
 if(matches.slice(1).some((match,index)=>!/^[/,、；;\s]+$/u.test(input.slice(matches[index].index+matches[index][0].length,match.index))))return;
 return slots;
}

export function lessonSlotMatches(slot:LessonAgendaSlot,kind:LessonPhase['kind'],minutes:number):boolean {
 return slot.minutes===minutes&&(slot.kind===kind||slot.kind==='closure'&&kind==='assessment');
}
