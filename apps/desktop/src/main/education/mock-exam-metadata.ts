import {MOCK_EXAM_GRADES,MOCK_EXAM_ROUNDS,MOCK_EXAM_SUBJECTS,SHANGHAI_DISTRICTS,
  type MockExamMetadata,type MockExamEntry,type MockExamScope} from '../../shared/mock-exam-compilation';

const districts=SHANGHAI_DISTRICTS.map(name=>[name,name==='浦东新区'?'浦东':name.slice(0,-1)] as const);
const gradeAliases=['初预','初一','初二','初三','高一年级','高二年级','高三年级'];
const numberedRounds=['第一轮','第二轮','第三轮','第四轮'];
const numericRounds=['1模','2模','3模','4模'];
const unique=<T>(values:T[])=>[...new Set(values)];
const hasMarker=(text:string)=>/(?:[一二三四1234]模|模考|模拟(?:考试|测试|卷)?|(?:第[一二三四]轮).{0,8}(?:模拟|测试))/u.test(text);
export const standaloneAnswers=(name:string)=>/(?:答案册|答案解析|参考答案|评分标准|答卷)(?:[）)\s_.-]|$)|答案(?:[）)]?\.[\da-z]+|[）)]?)$/iu.test(name)&&
  !/(?:含|附|及|带)(?:参考)?答案/u.test(name);
const yearsIn=(text:string)=>unique([...text.matchAll(/(?<!\d)(19[9]\d|20\d\d|2100)(?!\d)/gu)].map(hit=>Number(hit[1])));

function matches(text:string) {
  const round=MOCK_EXAM_ROUNDS.slice(0,4).filter((name,index)=>text.includes(name)||text.includes(numericRounds[index])||
    new RegExp(numberedRounds[index]+'.{0,8}(?:模拟|测试)','u').test(text));
  return {
    district:districts.filter(([,alias])=>text.includes(alias)).map(([name])=>name),
    year:yearsIn(text),
    subject:MOCK_EXAM_SUBJECTS.filter(name=>text.includes(name)),
    grade:MOCK_EXAM_GRADES.filter((name,index)=>text.includes(name)||text.includes(gradeAliases[index])),
    round:round.length?round:hasMarker(text)?['其他模拟' as const]:[],
  };
}
type Field=keyof MockExamMetadata;
const fields:Field[]=['district','year','subject','grade','round'];
export function inferMockExam(title:string,header:string,scope:MockExamScope) {
  const filename=title.normalize('NFKC'),body=header.normalize('NFKC');
  if(!hasMarker(filename+' '+body))return;
  const name=matches(filename),parsed=matches(body);
  const city=filename+' '+body;
  if(!name.district.length&&!parsed.district.length&&!city.includes('上海'))return;
  const allowed=<T>(values:T[],filter:T|undefined)=>filter===undefined||!values.length||values.includes(filter);
  if(!allowed([...name.year,...parsed.year],scope.year)||!allowed([...name.subject,...parsed.subject],scope.subject)||
    !allowed([...name.grade,...parsed.grade],scope.grade))return;
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
    if(!possible.length)continue;
    Object.assign(metadata,{[field]:possible[0]});
    inferred[field]=fromName.length&&fromBody.length?'文件名与正文':fromName.length?'原文件名称':'原件正文';
  }
  return {metadata,inferred,conflicts};
}

export const mockExamPosition=(metadata:MockExamMetadata)=>[metadata.year,metadata.district,metadata.grade,metadata.subject,metadata.round].join('|');
export const mockExamTitle=(scope:MockExamScope)=>[scope.year+' 年上海模考',scope.grade,scope.subject,'汇编'].filter(Boolean).join(' · ');
