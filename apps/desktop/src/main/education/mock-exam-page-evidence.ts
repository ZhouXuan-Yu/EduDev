import type {MockExamPageEvidence} from '../../shared/mock-exam-compilation';
import type {Sql} from '../xiaozhi-agent/session-state';

const inspectionLimit=128;
const pageNumber=(line:string)=>line.normalize('NFKC').match(/^\s*(?:第\s*)?(\d{1,3})\s*(?:页\s*)?\/\s*(?:共\s*)?(\d{1,3})\s*(?:页\s*)?$/u);
type Footer={physical:number;printed:number;total:number};

function footer(row:Record<string,unknown>):Footer[] {
  const physical=Number(row.page);
  const candidates=String(row.tail??'').split(/\r?\n/u).filter(line=>line.trim()).slice(-5)
    .flatMap(line=>{
      const matched=pageNumber(line);
      if(!matched)return [];
      const printed=Number(matched[1]),total=Number(matched[2]);
      return printed>0&&printed<=total&&total>=2&&total<=inspectionLimit?[{physical,printed,total}]:[];
    });
  return candidates.length===1?candidates:[];
}

export async function mockExamPageEvidence(work:Sql,source:Record<string,unknown>):Promise<MockExamPageEvidence|undefined> {
  const physicalPages=Number(source.pdf_total);
  if(!Number.isSafeInteger(physicalPages)||physicalPages<1||typeof source.pdf_generation!=='string'||
    !['complete','partial'].includes(String(source.pdf_state)))return;
  const unverified={state:'unverified' as const,physicalPages};
  if(physicalPages>inspectionLimit)return unverified;
  const pages=await work.all(`SELECT page,substr(json_extract(result_json,'$.text'),-1600) AS tail
    FROM material_pdf_pages WHERE generation=? AND status IN ('complete','needs_review')
    AND json_valid(result_json) ORDER BY page LIMIT ?`,[source.pdf_generation,inspectionLimit]);
  const printed=pages.flatMap(footer);
  if(printed.length<2||printed[0].physical!==1||printed[0].printed!==1)return unverified;
  const expected=printed[0].total;
  if(expected<physicalPages||printed.some((item,index)=>item.total!==expected||item.physical>physicalPages||
    (index>0&&item.printed-printed[index-1].printed<item.physical-printed[index-1].physical)))return unverified;
  const last=printed.at(-1)!;
  if(expected-last.printed<physicalPages-last.physical)return unverified;
  if(expected===physicalPages)return {state:'count_matches',physicalPages,printedPages:expected};
  const possibleMissingPages:number[]=[];
  const anchors=[...printed,{physical:physicalPages+1,printed:expected+1,total:expected}];
  for(let index=1;index<anchors.length;index++){
    const before=anchors[index-1],after=anchors[index];
    if(after.physical===before.physical+1)
      for(let missing=before.printed+1;missing<after.printed;missing++)possibleMissingPages.push(missing);
  }
  return {state:'possible_missing',physicalPages,printedPages:expected,possibleMissingPages};
}
