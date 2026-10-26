import type {XiaozhiPreviewInput,XiaozhiFileError} from './xiaozhi-files';
export const SCIENCE_EXPORT_SCHEMA='xiaozhi.science-export.v1' as const;
export type ScienceExportFormat='pptx'|'gif'|'pptx_merge';
export type ScienceExportInput=XiaozhiPreviewInput&{format:ScienceExportFormat};
export type ScienceExportOutput={requestId:string;path:string;format:ScienceExportFormat;bytes:number;sha256:string;frames:number;slides:number;
  merged?:{targetPath:string;targetSha256:string;targetSlides:number;generatedSlides:number;totalSlides:number}};
export type ScienceExportResult={ok:true;schemaVersion:typeof SCIENCE_EXPORT_SCHEMA;data:ScienceExportOutput}|{ok:false;schemaVersion:typeof SCIENCE_EXPORT_SCHEMA;error:XiaozhiFileError};
