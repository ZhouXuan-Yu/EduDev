import type {SourceReadingComparison} from '../../../shared/material-ai-source-reading';
import {DisclosureCard} from '../ui/DisclosureCard';

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
    {!!crop.issues.length&&<p role="note">该组仍有识别或完整性疑点，不能据此认定题面完整。</p>}
   </article>)}
  </section>)}
 </DisclosureCard>;
}
