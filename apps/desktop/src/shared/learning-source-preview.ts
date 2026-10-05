/** Teacher-facing projection of saved structured evidence. Technical flags never imply confirmation. */
export function learningSourcePreview(content:string):string{
 let v:Record<string,unknown>;try{v=JSON.parse(content);}catch{return content;}
 if(!v||typeof v!=='object'||Array.isArray(v))return '请在学生档案查看这条原始记录。';
 if(v.schemaVersion==='xiaozhi.education.mistake-facts.v1'&&(content.length>65536||['knowledgePoint','actualAnswer','expectedAnswer','errorCause'].some(k=>typeof v[k]!=='string'||(v[k] as string).length>12000)||!['correct','incorrect','partial'].includes(String(v.result))||!['easy','medium','hard'].includes(String(v.difficulty))))return '这条错题记录的内容不完整，请核对保存的学习记录。';
 const lines:string[]=[];
 for(const [key,label]of[['knowledgePoint','知识点'],['question','题目'],['userAnswer','学生作答'],['actualAnswer','实际作答'],['expectedAnswer','参考答案'],['errorCause','教师记录的错因'],['feedback','原记录反馈'],['summary','原记录说明'],['notes','教师观察']]as const)if(typeof v[key]==='string')lines.push(`${label}：${v[key]|| (key==='actualAnswer'?'未作答':'')}`);
 const difficulty:Record<string,string>={easy:'基础',medium:'中等',hard:'较难'};if(typeof v.difficulty==='string'&&difficulty[v.difficulty])lines.push(`难度：${difficulty[v.difficulty]}`);
 const types:Record<string,string>={concept:'概念理解',procedure:'解题方法',memory:'记忆',design:'综合设计'};
 if(typeof v.knowledgeType==='string'&&types[v.knowledgeType])lines.push(`学习类型：${types[v.knowledgeType]}`);
 const result=v.result??(typeof v.isCorrect==='boolean'?(v.isCorrect?'correct':'incorrect'):undefined),labels:Record<string,string>={correct:'正确',incorrect:'错误',partial:'部分正确'};
 if(typeof result==='string'&&labels[result])lines.push(`原记录结果：${labels[result]}`);
 return lines.length?lines.join('\n'):'请在学生档案查看这条原始记录。';
}
