/** Read only Unicode cmap membership from trusted installed sfnt/TTC fonts; never execute outlines. */
export function fontGlyphCoverage(input:Uint8Array):(codePoint:number)=>boolean{
 const data=Buffer.from(input),maps:Array<(cp:number)=>boolean>=[];
 const fail=()=>{throw Error('font_unavailable');};
 function bound(at:number,size:number,end=data.length){if(!Number.isSafeInteger(at)||!Number.isSafeInteger(size)||at<0||size<0||at+size>end||end>data.length)fail();}
 function u16(at:number){bound(at,2);return data.readUInt16BE(at);}
 function u32(at:number){bound(at,4);return data.readUInt32BE(at);}
 if(data.length<12||data.length>64*1048576)fail();
 const faces=data.toString('ascii',0,4)==='ttcf'?(()=>{const count=u32(8);if(count<1||count>32)fail();bound(12,count*4);return Array.from({length:count},(_,i)=>u32(12+i*4));})():[0];
 for(const face of faces){
  bound(face,12);const signature=u32(face);if(signature!==0x00010000&&signature!==0x4f54544f)fail();
  const tables=u16(face+4);if(!tables||tables>512)fail();bound(face+12,tables*16);
  for(let t=0;t<tables;t++){
   const record=face+12+t*16;if(data.toString('ascii',record,record+4)!=='cmap')continue;
   const offset=u32(record+8),length=u32(record+12),end=offset+length;bound(offset,length);if(length<4||u16(offset)!==0)fail();
   const records=u16(offset+2);if(records>64)fail();bound(offset+4,records*8,end);
   for(let r=0;r<records;r++){
    const at=offset+4+r*8,platform=u16(at),encoding=u16(at+2);if(platform!==0&&!(platform===3&&(encoding===1||encoding===10)))continue;
    const sub=offset+u32(at+4);bound(sub,2,end);const format=u16(sub);
    if(format===12){
     bound(sub,16,end);const size=u32(sub+4),groups=u32(sub+12);if(size<16||groups>200000||16+groups*12>size)fail();bound(sub,size,end);
     const entries:Array<[number,number,number]>=[];let previous=-1;
     for(let i=0;i<groups;i++){const p=sub+16+i*12,start=u32(p),stop=u32(p+4),glyph=u32(p+8);if(start>stop||stop>0x10ffff||start<=previous)fail();previous=stop;entries.push([start,stop,glyph]);}
     maps.push(cp=>{let lo=0,hi=entries.length-1;while(lo<=hi){const mid=(lo+hi)>>>1,[start,stop,glyph]=entries[mid];if(cp<start)hi=mid-1;else if(cp>stop)lo=mid+1;else return glyph+cp-start!==0;}return false;});
    }else if(format===4){
     bound(sub,14,end);const size=u16(sub+2),twice=u16(sub+6),count=twice/2;if(!count||twice%2||16+count*8>size)fail();bound(sub,size,end);
     const ends=sub+14,starts=ends+count*2+2,deltas=starts+count*2,ranges=deltas+count*2;let previous=-1;
     for(let i=0;i<count;i++){const stop=u16(ends+i*2),start=u16(starts+i*2);if(start>stop||stop<previous)fail();previous=stop;const range=u16(ranges+i*2);if(range)bound(ranges+i*2+range,(stop-start+1)*2,sub+size);}
     maps.push(cp=>{
      if(cp>0xffff)return false;let lo=0,hi=count-1;
      while(lo<hi){const mid=(lo+hi)>>>1;if(u16(ends+mid*2)<cp)lo=mid+1;else hi=mid;}
      const start=u16(starts+lo*2);if(cp<start||cp>u16(ends+lo*2))return false;
      const range=u16(ranges+lo*2),delta=u16(deltas+lo*2),glyph=range?u16(ranges+lo*2+range+(cp-start)*2):cp;
      return (range&&glyph===0?0:(glyph+delta)&0xffff)!==0;
     });
    }
   }
  }
 }
 if(!maps.length)fail();
 return cp=>Number.isSafeInteger(cp)&&cp>=0&&cp<=0x10ffff&&!(cp>=0xd800&&cp<=0xdfff)&&maps.some(map=>map(cp));
}
export function assertWordGlyphs(text:string,fonts:ReadonlyArray<(cp:number)=>boolean>){
 if(!fonts.length)throw Error('font_unavailable');
 for(const char of new Set(text)){if(/[\n\r\t]/u.test(char))continue;const cp=char.codePointAt(0)!;if(!fonts.some(has=>has(cp)))throw Error('font_missing_glyph');}
}
