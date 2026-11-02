/** Local-only failure metadata: never retain worker text, stderr, paths or credentials. */
export const OCR_DIAGNOSTIC_SCHEMA='xiaozhi.local-ocr-diagnostic.v1';
export const OCR_FAILURE_PHASES=['spawn','stdin','exit','utf8','json','schema','worker','timeout','cancelled','stdout_limit','stderr_limit','progress'] as const;
export type OcrDiagnostic={schemaVersion:typeof OCR_DIAGNOSTIC_SCHEMA;phase:typeof OCR_FAILURE_PHASES[number];exitCode:number|null;signalled:boolean;stdoutBytes:number;stderrBytes:number};
export function validOcrDiagnostic(value:unknown):value is OcrDiagnostic{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const d=Object.getOwnPropertyDescriptors(value),keys=['schemaVersion','phase','exitCode','signalled','stdoutBytes','stderrBytes'];
 if(Reflect.ownKeys(value).length!==keys.length||keys.some(k=>!d[k]||!('value'in d[k]))||Object.values(d).some(v=>!('value'in v)||!v.enumerable))return false;
 const v=value as OcrDiagnostic;
 return v.schemaVersion===OCR_DIAGNOSTIC_SCHEMA&&OCR_FAILURE_PHASES.includes(v.phase)&&(v.exitCode===null||Number.isSafeInteger(v.exitCode)&&Math.abs(v.exitCode)<=4294967295)&&typeof v.signalled==='boolean'&&[v.stdoutBytes,v.stderrBytes].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=2147483647);
}
