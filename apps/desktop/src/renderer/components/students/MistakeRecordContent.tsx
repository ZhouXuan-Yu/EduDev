import {learningSourcePreview} from '../../../shared/learning-source-preview';

/** Presentation only. The host remains responsible for verifying learning facts. */
export function MistakeRecordContent({content}:{content:string}){
 return <p data-testid="mistake-record-content" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{learningSourcePreview(content)||'暂无正文'}</p>;
}
