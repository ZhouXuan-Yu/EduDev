/** Match the same NFKC/case/whitespace-normalised terms as FTS, retaining original offsets. */
export function materialSnippet(text:string,query:string){
 let normalized='',offset=0;const positions:number[]=[];
 for(const char of text){const part=char.normalize('NFKC').toLowerCase().replace(/\s+/gu,'');normalized+=part;for(let i=0;i<part.length;i++)positions.push(offset);offset+=char.length;}
 let found=-1;for(const term of query.trim().split(/\s+/u).filter(Boolean).slice(0,12)){const index=normalized.indexOf(term.normalize('NFKC').toLowerCase());if(index>=0&&(found<0||index<found))found=index;}
 const start=Math.max(0,(positions[found]??0)-70);return text.slice(start,start+400);
}
