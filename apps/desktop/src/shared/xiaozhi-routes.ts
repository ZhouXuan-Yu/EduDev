export const ROUTE_CHOICES=['conversation','public_web','local_files','education','selected_memory','student_facts','mixed','clarify','extension','unknown','control'] as const;
export type RouteChoice=typeof ROUTE_CHOICES[number];
export type RouteState={intent:'conversation'|'web'|'files'|'education'|'memory'|'mixed';memory:'off'|'empty'|'selected'|'unavailable';student:boolean;files:boolean;web:boolean};
export type RouteObservation={state:'recorded'|'unavailable';counts:Partial<Record<RouteChoice,number>>;succeeded:number;failed:number;unknown:number;sourceCurrent:boolean};
export type RouteSummary={version:1;suggested:RouteChoice;observed?:RouteObservation;shadow?:{result:RouteChoice|'abstain';state:'recorded'|'failed'|'stale';elapsedMs:number}};
export const ROUTE_LABELS:Record<RouteChoice,string>={conversation:'直接对话',public_web:'公开联网',local_files:'本地文件',education:'教学工具',selected_memory:'已选记忆',student_facts:'当前学生记录',mixed:'组合任务',clarify:'先核对可用资料',extension:'已授权扩展',unknown:'未分类',control:'任务控制'};
