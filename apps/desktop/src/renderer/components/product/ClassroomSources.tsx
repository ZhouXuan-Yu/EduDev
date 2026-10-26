import type {ClassroomContext} from '../../../shared/classroom-context';
import {MaterialSourceLink} from './MaterialSourceNavigation';

/** Same verified source navigation as chat; references are supplied only by main. */
export function ClassroomSources({context}:{context?:ClassroomContext}){
 return <section data-testid="classroom-sources" aria-label="课堂参考资料">
  <p>{context?.materials.length?'本次实际读取的资料段落；课堂为 AI 教学草稿，参考资料不等于题意、图形或答案已经核验。':'此课堂没有保存可核对的资料段落关联，不能视为教材原文。'}</p>
  {!!context?.materials.length&&<ul>{context.materials.map(m=><MaterialSourceLink key={m.source.chunkId} source={{material:m.source,title:`${m.title} · 第${m.source.offset+1}段${m.truncated?'（仅部分文字）':''}${m.recognition==='local_ocr_unreviewed'?'（本地识别，待核对）':''}`}}/>)}</ul>}
 </section>;
}
