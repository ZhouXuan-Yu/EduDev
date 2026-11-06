import type {SourceReadingComparison} from '../../../shared/material-ai-source-reading';
import {DisclosureCard} from '../ui/DisclosureCard';
import {sourcePartRanges} from '../../../shared/question-source-content';

const roleNames={marker:'原题编号',body:'题面正文',figure:'配图原文',publication:'出版出处（AI分区，待教师核对）'};

export function MaterialSourceReadings({readings}:{readings:SourceReadingComparison[]}){
 if(!readings.length)return null;
 return <DisclosureCard title="原图转录与OCR纠正依据" headingLevel={4} data-testid="material-source-readings">
  <p>原OCR保留在本机。以下是AI对照同一裁图的逐字转录与判断；双遍一致仍不等于教师核验或答案正确，正式组卷时请集中核对。</p>
  {readings.map(row=><section key={row.number} data-testid="material-source-reading-question" data-number={row.number}>
   <h5>第{row.number}题</h5>
   {row.crops.map((crop,i)=><article key={i} data-testid="material-source-reading-crop" data-assessment={crop.assessment}>
    <p>第{i+1}组 · {crop.assessment==='exact'?'文字与OCR一致':crop.assessment==='corrected'?'AI已纠正OCR差异':'转录仍有疑点'} · {crop.agrees?'两份原图转录一致':'尚未形成一致的来源转录'}</p>
    <p>本地OCR</p><pre className="material-ai-page-text" data-testid="material-source-reading-ocr">{crop.ocrText||'本地OCR未获得文字'}</pre>
    <p>AI原图逐字转录</p><pre className="material-ai-page-text" data-testid="material-source-reading-text">{crop.text||'本次未转录出文字'}</pre>
    {crop.parts&&<div data-testid="material-source-content">
     <p>原文分区保留全部文字；字符位置对应本组完整转录，不能据分区判断答案正确。</p>
     {sourcePartRanges({text:crop.text,parts:crop.parts}).map((part,k)=><section key={k} data-testid="material-source-part" data-role={part.role}>
      <p>{roleNames[part.role]} · 字符 {part.start}–{part.end}</p><pre className="material-ai-page-text">{part.text}</pre>
     </section>)}
     {crop.publicationStatus==='needs_review'&&<p role="note" data-testid="material-source-publication-review">两遍出版出处存在差异，保留原文待核；不能把出处或星级当作已确认事实。</p>}
     {crop.previousText!==crop.text&&<><p>上一遍原图转录</p><pre className="material-ai-page-text">{crop.previousText}</pre></>}
    </div>}
    {!!crop.issues.length&&<p role="note">该组仍有识别或完整性疑点，不能据此认定题面完整。</p>}
   </article>)}
  </section>)}
 </DisclosureCard>;
}
