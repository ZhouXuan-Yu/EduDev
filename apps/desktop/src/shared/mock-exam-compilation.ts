export const MOCK_EXAM_SCHEMA='xiaozhi.mock-exam-compilation.v1';
export const BUILD_MOCK_EXAM_CATALOG='education_build_mock_exam_catalog';
export const SHANGHAI_DISTRICTS=['黄浦区','徐汇区','长宁区','静安区','普陀区','虹口区','杨浦区','闵行区',
  '宝山区','嘉定区','浦东新区','金山区','松江区','青浦区','奉贤区','崇明区'] as const;
export const MOCK_EXAM_SUBJECTS=['语文','数学','英语','物理','化学','生物','历史','地理','政治','道德与法治','信息技术','科学'] as const;
export const MOCK_EXAM_GRADES=['六年级','七年级','八年级','九年级','高一','高二','高三'] as const;
export const MOCK_EXAM_ROUNDS=['一模','二模','三模','四模','其他模拟'] as const;

export type MockExamScope={year:number;subject?:typeof MOCK_EXAM_SUBJECTS[number];grade?:typeof MOCK_EXAM_GRADES[number]};
export type MockExamMetadata={district:typeof SHANGHAI_DISTRICTS[number]|null;year:number|null;
  subject:typeof MOCK_EXAM_SUBJECTS[number]|null;grade:typeof MOCK_EXAM_GRADES[number]|null;round:typeof MOCK_EXAM_ROUNDS[number]|null};
export type MockExamEntry={resourceId:string;version:string;title:string;evidenceHash:string;metadata:MockExamMetadata;
  inferred:Partial<Record<keyof MockExamMetadata,'原文件名称'|'原件正文'|'文件名与正文'|'老师核对'>>;
  conflicts:(keyof MockExamMetadata)[];copies:number;include:boolean;permission:'unknown'|'local_only'|'excluded';
  structure:{state:'unavailable'|'partial'|'parsed';pages?:number;processed?:number;held?:number};
  answer:{state:'missing'|'linked'|'stale'|'embedded';resourceId?:string;version?:string;title?:string;pairRevision?:number};
};
export type MockExamCatalogSummary={schemaVersion:typeof MOCK_EXAM_SCHEMA;id:string;runId:string;taskId:string;title:string;
  revision:number;state:'draft'|'confirmed';count:number;digest:string};
export type MockExamCatalog={summary:MockExamCatalogSummary;scope:MockExamScope;entries:MockExamEntry[];unlinkedAnswers:number;limited:boolean};
export type MockExamCatalogKey={schemaVersion:typeof MOCK_EXAM_SCHEMA;sessionId:string;id:string};
export type MockExamCatalogChange={resourceId:string;metadata:MockExamMetadata;include:boolean;permission:MockExamEntry['permission']};
export type MockExamCatalogConfirm=MockExamCatalogKey&{revision:number;digest:string;changes:MockExamCatalogChange[]};
export type MockExamCatalogOriginal=MockExamCatalogKey&{resourceId:string};
export type MockExamResult<T>={ok:true;value:T}|{ok:false;error:string;message:string};

export const mockExamYear=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=1990&&value<=2100;
const member=<T extends string>(choices:readonly T[],value:unknown):value is T=>typeof value==='string'&&choices.includes(value as T);
export const validMockExamScope=(value:Record<string,unknown>):value is MockExamScope=>
  Object.keys(value).every(key=>['year','subject','grade'].includes(key))&&mockExamYear(value.year)&&
  (value.subject===undefined||member(MOCK_EXAM_SUBJECTS,value.subject))&&(value.grade===undefined||member(MOCK_EXAM_GRADES,value.grade));
export function validMockExamMetadata(value:unknown):value is MockExamMetadata {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const data=value as Record<string,unknown>;
  return Object.keys(data).length===5&&(data.district===null||member(SHANGHAI_DISTRICTS,data.district))&&
    (data.year===null||mockExamYear(data.year))&&(data.subject===null||member(MOCK_EXAM_SUBJECTS,data.subject))&&
    (data.grade===null||member(MOCK_EXAM_GRADES,data.grade))&&(data.round===null||member(MOCK_EXAM_ROUNDS,data.round));
}
export const catalogId=(value:unknown):value is string=>typeof value==='string'&&/^mock_catalog_[a-f0-9-]{36}$/u.test(value);
export const mockExamParameters={type:'object',additionalProperties:false,required:['year'],properties:{
  year:{type:'integer',minimum:1990,maximum:2100},subject:{type:'string',enum:MOCK_EXAM_SUBJECTS},grade:{type:'string',enum:MOCK_EXAM_GRADES},
}};
export const mockExamErrors:Record<string,string>={
  invalid_input:'请选择有效的年份、学科和年级。',
  no_sources:'资料库中没有找到符合范围的模考试卷。请导入原件或核对年份、学科与年级。',
  incomplete:'还有试卷的区、年份、学科、年级或轮次需要核对。',
  conflicting_versions:'有多份不同原件对应同一区、同年级、同学科和同轮次。请仅保留一份。',
  scope_changed:'保留的试卷超出当前目录范围，请核对元数据或取消收录。',
  source_changed:'原件、页面状态或答案册配对发生变化。请重新生成目录后核对。',
  version_conflict:'目录版本已变化，请重新读取。',
  permission_denied:'当前窗口或会话无法操作这份目录。',
  configuration:'暂时无法处理模考目录，请重新读取。',
};
