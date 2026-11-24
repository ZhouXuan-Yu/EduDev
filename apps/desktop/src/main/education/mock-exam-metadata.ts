import {MOCK_EXAM_GRADES,MOCK_EXAM_ROUNDS,MOCK_EXAM_SUBJECTS,SHANGHAI_DISTRICTS,
  mockExamYear,mockExamScopeLabel,type MockExamCoverEvidence,type MockExamMetadata,type MockExamEntry,type MockExamScope} from '../../shared/mock-exam-compilation';

import {equivalentQuestionGradeLabels} from '../../shared/question-grade';

const districts=SHANGHAI_DISTRICTS.map(name=>[name,name==='浦东新区'?'浦东':name.slice(0,-1)] as const);
const numberedRounds=['第一轮','第二轮','第三轮','第四轮'];
const numericRounds=['1模','2模','3模','4模'];
const unique=<T>(values:T[])=>[...new Set(values)];
const hasMarker=(text:string)=>/(?:[一二三四1234]模|模考|模拟(?:考试|测试|卷)?|(?:第[一二三四]轮).{0,8}(?:模拟|测试))/u.test(text);
export const standaloneAnswers=(name:string)=>/(?:答案册|答案解析|参考答案|评分标准|答卷)(?:[）)\s_.-]|$)|答案(?:[）)]?\.[\da-z]+|[）)]?)$/iu.test(name)&&
  !/(?:含|附|及|带)(?:参考)?答案/u.test(name);
const yearsIn=(text:string)=>unique([...text.matchAll(/(?<!\d)(19[9]\d|20\d\d|2100)(?!\d)/gu)].map(hit=>Number(hit[1])));
const questionStart=/(?:^|[。；\s])(?:(?:[一二三四五六七八九十]+[、.]\s*)?(?:填空题|选择题|解答题|计算题|简答题|实验题|阅读理解)|第\s*\d+\s*题|[1-9]\d?[.．、]\s*(?!\d))/u;

/** Read the bounded first-page title before the printed question sections. */
export function mockExamCoverHeader(text:string):string {
  const lines:string[]=[];
  for(const line of text.normalize('NFKC').split(/\r?\n/u).map(value=>value.trim()).filter(Boolean).slice(0,6)){
    const boundary=line.search(questionStart);
    if(boundary<0){lines.push(line);continue;}
    if(boundary>0)lines.push(line.slice(0,boundary).trim());
    break;
  }
  const heading=lines.join('\n');
  return hasMarker(heading)?heading:'';
}

function coverEvidence(filename:string,heading:string) {
  const evidence:MockExamCoverEvidence={page:1};
  const terms=[...heading.matchAll(/(?<!\d)(\d{4})\s*(?:[-–—~至]\s*(\d{4}))?\s*学年(?:度)?/gu)];
  const academicYear=Number(terms[0]?.[1]),academicEndYear=Number(terms[0]?.[2]);
  if(terms.length===1&&mockExamYear(academicYear)){
    evidence.academicYear=academicYear;
    if(mockExamYear(academicEndYear)&&academicEndYear===academicYear+1)evidence.academicEndYear=academicEndYear;
  }
  const dates=unique([...heading.matchAll(/(?<!\d)(\d{4})\s*[.年/-]\s*(1[0-2]|0?[1-9])(?:\s*月)?(?!\d|届|学年)/gu)]
    .filter(match=>mockExamYear(Number(match[1]))).map(match=>Number(match[1])*100+Number(match[2])));
  if(dates.length===1)evidence.examMonth={year:Math.trunc(dates[0]/100),month:dates[0]%100};
  const cohorts=unique([...filename.matchAll(/(?<!\d)(\d{4})\s*届/gu)].map(match=>Number(match[1])).filter(mockExamYear));
  if(cohorts.length===1)evidence.filenameCohort=cohorts[0];
  return evidence;
}

export const mockExamDistrictsIn=(text:string)=>districts.filter(([,alias])=>text.includes(alias)).map(([name])=>name);
export const mockExamGradesIn=(text:string)=>MOCK_EXAM_GRADES.filter(grade=>
  equivalentQuestionGradeLabels(grade).some(label=>text.includes(label))||grade==='六年级'&&/初预|预初/u.test(text));
export const mockExamNumberedRoundsIn=(text:string)=>MOCK_EXAM_ROUNDS.slice(0,4).filter((name,index)=>
  text.includes(name)||text.includes(numericRounds[index])||new RegExp(numberedRounds[index]+'.{0,8}(?:模拟|测试)','u').test(text));

function matches(text:string) {
  const round=mockExamNumberedRoundsIn(text);
  return {
    district:mockExamDistrictsIn(text),
    year:yearsIn(text),
    subject:MOCK_EXAM_SUBJECTS.filter(name=>text.includes(name)),
    grade:mockExamGradesIn(text),
    round:round.length?round:hasMarker(text)?['其他模拟' as const]:[],
  };
}
type Field=keyof MockExamMetadata;
const fields:Field[]=['district','year','subject','grade','round'];
export function inferMockExam(title:string,header:string,scope:MockExamScope,pageOne='') {
  const cover=pageOne?coverEvidence(title.normalize('NFKC'),pageOne):undefined;
  const filename=title.normalize('NFKC'),body=pageOne||header.normalize('NFKC');
  if(!hasMarker(filename+' '+body))return;
  const name=matches(filename),parsed=matches(body);
  if(cover){
    if(cover.filenameCohort!==undefined)name.year=[cover.filenameCohort];
    const printedYears=[cover.academicYear,cover.examMonth?.year].filter(mockExamYear);
    if(printedYears.length)parsed.year=unique(printedYears);
  }
  const city=filename+' '+body;
  if(!name.district.length&&!parsed.district.length&&!city.includes('上海'))return;
  const allowed=<T>(values:T[],filter:T|undefined)=>filter===undefined||!values.length||values.includes(filter);
  if(!allowed([...name.year,...parsed.year],scope.year)||!allowed([...name.subject,...parsed.subject],scope.subject)||
    !allowed([...name.grade,...parsed.grade],scope.grade))return;
  const districtsFound=[...name.district,...parsed.district];
  const roundsFound=[...name.round,...parsed.round].filter(round=>round!=='其他模拟');
  if(scope.districts&&districtsFound.length&&!districtsFound.some(district=>scope.districts!.includes(district)))return;
  if(scope.rounds&&roundsFound.length&&!roundsFound.some(round=>scope.rounds!.includes(round)))return;
  const inferred:MockExamEntry['inferred']={},conflicts:Field[]=[];
  const metadata:MockExamMetadata={district:null,year:null,subject:null,grade:null,round:null};
  for(const field of fields){
    let fromName:readonly (string|number)[]=name[field],fromBody:readonly (string|number)[]=parsed[field];
    // A generic mock heading has no numbered-round assertion.
    if(field==='round'&&fromName.length&&fromBody.length){
      if(fromName[0]==='其他模拟'&&fromBody[0]!=='其他模拟')fromName=[];
      if(fromBody[0]==='其他模拟'&&fromName.length&&fromName[0]!=='其他模拟')fromBody=[];
    }
    const possible=unique([...fromName,...fromBody]);
    if(possible.length>1){conflicts.push(field);continue;}
    if(!possible.length||field==='round'&&possible[0]==='其他模拟'&&scope.rounds&&!scope.rounds.includes('其他模拟'))continue;
    Object.assign(metadata,{[field]:possible[0]});
    inferred[field]=fromName.length&&fromBody.length?'文件名与正文':fromName.length?'原文件名称':'原件正文';
  }
  return {metadata,inferred,conflicts,...(cover?{cover}:{})};
}

export const mockExamPosition=(metadata:MockExamMetadata)=>[metadata.year,metadata.district,metadata.grade,metadata.subject,metadata.round].join('|');
export const mockExamTitle=(scope:MockExamScope)=>mockExamScopeLabel(scope)+' · 汇编';
