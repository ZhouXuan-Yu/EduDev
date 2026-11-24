import {MOCK_EXAM_ROUNDS,MOCK_EXAM_SUBJECTS,SHANGHAI_DISTRICTS,mockExamYear,validMockExamScope,
  type MockExamScope} from '../../shared/mock-exam-compilation';
import {plainStudentInput} from '../../shared/student-context';
import {mockExamDistrictsIn,mockExamGradesIn,mockExamNumberedRoundsIn} from './mock-exam-metadata';

function statedScope(prompt:string) {
  const text=prompt.normalize('NFKC')
    .replace(/\x60{3}[\s\S]*?(?:\x60{3}|$)|《[^》\n]*》|“[^”\n]*”|「[^」\n]*」/gu,' ')
    .replace(/(?:比如|例如|举例|不含|不包括|不收录|不整理|不要(?!遗漏|漏掉|漏收|排除|省略)|别(?:把)?|排除)[^。！？；;，,\n]*/gu,' ')
    .replace(/(?:题示|提示词示例)\s*:[^\n]*/gu,' ');
  const years=new Set(Array.from(text.matchAll(/(?<!\d)(\d{4})\s*(?:年(?!级)|届)/gu),match=>Number(match[1])).filter(mockExamYear));
  if(years.size>1||/(?<!\d)\d{4}\s*[-–—~至]\s*\d{4}\s*(?:学年|年)/u.test(text))throw Error('scope_ambiguous');
  const subjects=MOCK_EXAM_SUBJECTS.filter(subject=>text.includes(subject));
  const grades=mockExamGradesIn(text);
  const districts=mockExamDistrictsIn(text);
  const rounds=[...mockExamNumberedRoundsIn(text),...(text.includes('其他模拟')?['其他模拟' as const]:[])];
  return {
    year:[...years][0],subject:subjects.length===1?subjects[0]:undefined,grade:grades.length===1?grades[0]:undefined,
    districts,rounds,allDistricts:/上海(?:市)?各区|上海全市|全上海|上海十六区|上海16区/u.test(text),
  };
}

function boundList<T>(supplied:T[]|undefined,asked:T[],order:readonly T[]) {
  if(asked.length&&supplied&&(asked.length!==supplied.length||asked.some(value=>!supplied.includes(value))))
    throw Error('scope_mismatch');
  const chosen=asked.length?asked:supplied;
  return chosen?order.filter(value=>chosen.includes(value)):undefined;
}

/** Anchor unambiguous teacher requirements before scanning or creating a catalog. */
export function resolveMockExamScope(prompt:string,raw:unknown):MockExamScope {
  if(!plainStudentInput(raw,['year','subject','grade','districts','rounds'])||!validMockExamScope(raw))throw Error('invalid_input');
  const asked=statedScope(prompt);
  if(asked.year!==undefined&&raw.year!==asked.year||
    asked.subject&&raw.subject&&raw.subject!==asked.subject||asked.grade&&raw.grade&&raw.grade!==asked.grade||
    asked.allDistricts&&raw.districts&&!asked.districts.length)throw Error('scope_mismatch');
  const subject=asked.subject??raw.subject,grade=asked.grade??raw.grade;
  const districts=boundList(raw.districts,asked.districts,SHANGHAI_DISTRICTS);
  const rounds=boundList(raw.rounds,asked.rounds,MOCK_EXAM_ROUNDS);
  return {year:raw.year,...(subject?{subject}:{}),...(grade?{grade}:{}),...(districts?{districts}:{}),...(rounds?{rounds}:{})};
}
