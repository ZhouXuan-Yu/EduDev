import {deflateSync} from 'node:zlib';
/** Small real PDFs with explicit physical pages; no generator/model text is used as a render receipt. */
export function pdfFixture(count=3,imageOnly=false){
 const objects=[],add=v=>{objects.push(Buffer.isBuffer(v)?v:Buffer.from(v));return objects.length;},stream=(data,dict='')=>Buffer.concat([Buffer.from(`<< ${dict} /Length ${data.length} >>\nstream\n`),data,Buffer.from('\nendstream')]);
 add('<< /Type /Catalog /Pages 2 0 R >>');add(`<< /Type /Pages /Kids [${Array.from({length:count},(_,i)=>`${3+i*2} 0 R`).join(' ')}] /Count ${count} >>`);
 for(let page=1;page<=count;page++){
  add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << ${imageOnly?'/XObject << /Im0':'/Font << /F1'} ${3+count*2} 0 R >> >> /Contents ${4+(page-1)*2} 0 R >>`);
  add(stream(Buffer.from(imageOnly?'q 150 0 0 200 72 500 cm /Im0 Do Q':`BT /F1 24 Tf 72 760 Td (ACTUAL_PAGE_${page}) Tj 0 -40 Td (Depth: 6cm) Tj ET`)));
 }
 add(imageOnly?stream(deflateSync(Buffer.from([20,90,210])),'/Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode'):'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 const chunks=[Buffer.from('%PDF-1.7\n')],offsets=[0];let length=chunks[0].length;
 for(const [i,object]of objects.entries()){offsets.push(length);const chunk=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from('\nendobj\n')]);chunks.push(chunk);length+=chunk.length;}
 chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));return Buffer.concat(chunks);
}
