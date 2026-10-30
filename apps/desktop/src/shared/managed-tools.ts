export type ManagedToolStatus='ready'|'missing_dependency'|'authorization_required'|'unsupported'|'fault';
export type ManagedToolPhase='checking'|'downloading'|'verifying'|'installing'|'health'|'activating'|'ready'|'cancelled'|'failed';
export type ManagedToolProgress={phase:ManagedToolPhase;downloadedBytes:number;error?:string;totalBytes?:number;version?:string};
export type ManagedToolView={id:string;name:string;version:string;status:ManagedToolStatus;reason:string;nextAction:string;
  sourceUrl:string;license:string;downloadBytes:number;installedBytes:number;origin?:'builtin'|'download';inUse:number;
  phase?:ManagedToolPhase;downloadedBytes?:number;error?:string;recommendedVersion?:string;previousVersion?:string;
  versions?:{version:string;ready:boolean;origin?:'builtin'|'download';inUse:number}[];running?:number;queued?:number;maximumConcurrent?:number;notice?:string;preparingVersion?:string;preparingBytes?:number};
export type ManagedToolResult<T>={ok:true;value:T}|{ok:false;error:string};
export type ManagedToolInput={id:string;commandId:string};
export type ManagedToolVersionInput=ManagedToolInput&{version:string};
export const MANAGED_TOOL_ERRORS:Record<string,string>={csv_invalid:'CSV引用、列标题、列数或编码格式不正确，请检查原数据。',table_limit:'数据超过当前行数或容量限制，未截断计算。',table_type:'列中包含无法按声明解析的数值，请核对小数点和原值。',missing_numeric:'必填数值为空，未按0替代，请补齐原数据。',cancelled:'已取消准备；不会继续安装。',unsupported:'当前系统不支持这项工具。',authorization_required:'这项工具不在认可清单，请先确定来源、用途和费用。',
  checksum_mismatch:'下载或本地组件校验不一致，请重新准备。',archive_invalid:'组件包格式或内容不正确。',health_failed:'组件检查未通过，原有可用版本保留。',network_error:'下载未完成；重试会重新下载。',no_space:'本机可用空间不足，未删除任何教学成果。',permission_denied:'组件目录不可写或路径不可用。',busy:'组件正在准备或被任务使用，稍后再试。',worker_failed:'计算进程未正常完成。',timeout:'计算已超时并停止。',output_limit:'计算输出过大，未发布截断文件。',invalid_domain:'计算出现非有限值，请检查定义域或输入条件。',invalid_input:'工具参数不正确。',configuration:'暂时无法读取工具状态，请重试。'};
