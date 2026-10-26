/** Every admitted non-empty section is persisted; bounds belong to the parser protocol. */
export function splitMaterialText(content:string,maxLength=1200){
 if(!Number.isSafeInteger(maxLength)||maxLength<1)throw new Error('invalid_chunk_size');
 const normalized=content.replace(/\r\n/g,'\n').trim();
 const chunks:Array<{heading:string;content:string}>=[];
 if(!normalized)return chunks;
 for(const section of normalized.split(/\n(?=#{1,6}\s+)/g)){
  const heading=section.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim()??'';
  let remaining=section.trim();
  while(remaining.length>maxLength){chunks.push({heading,content:remaining.slice(0,maxLength).trim()});remaining=remaining.slice(maxLength).trim();}
  if(remaining)chunks.push({heading,content:remaining});
 }
 return chunks;
}
