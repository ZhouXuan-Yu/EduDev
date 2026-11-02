import {validPaperExportIntent,type PaperExportIntent} from '../../../shared/paper-export';

/** Input compatibility only. Host admission and Office approval remain authoritative. */
export function paperExportSendError(intent:PaperExportIntent|undefined,context:{running?:boolean;attachments?:boolean;continuation?:boolean;invalid?:boolean}):string|undefined{
 if(context.invalid||intent!==undefined&&!validPaperExportIntent(intent))return '导出请求绑定无法读取，原输入已保留。请取消本次导出请求，再从确认卷重新准备。';
 if(!intent)return;
 if(context.running||context.continuation)return '绑定确认卷的导出请求不能作为补充或续接发送。请等待本轮结束后单独发送；原输入已保留。';
 if(context.attachments)return '绑定确认卷的导出请求不能混合附件发送。请先移除附件，原输入和导出绑定已保留。';
}
