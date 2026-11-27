import type {LearningRecord} from '../../shared/contracts';

/** Uses existing host pagination; a search hit must be present before claiming location. */
export async function locateRecordPage(read:(offset:number)=>Promise<LearningRecord[]>, id:string):Promise<LearningRecord[]> {
  for(let offset=0;offset<10000;offset+=100){
    const page=await read(offset);
    if(page.some(record=>record.id===id))return page;
    if(page.length<100)break;
  }
  throw new Error('尚未定位到原记录。它可能已变化，或超出本次读取范围，请重新检索。');
}
