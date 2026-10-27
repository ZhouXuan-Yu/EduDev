import {deflateSync} from 'node:zlib';
/** Controlled pixel producer for persistence tests; it is never evidence of source layout fidelity. */
export function nativeTestPng(color){
 const chunk=(kind,data)=>{const body=Buffer.concat([Buffer.from(kind),data]);let n=0xffffffff;for(const b of body){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}const length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE((n^0xffffffff)>>>0);return Buffer.concat([length,body,crc]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(1240,0);header.writeUInt32BE(64,4);header[8]=8;header[9]=6;
 const row=Buffer.alloc(1240*4+1);for(let x=1;x<row.length;x+=4){row[x]=color;row[x+1]=128;row[x+2]=208;row[x+3]=255;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.concat(Array.from({length:64},()=>row)))),chunk('IEND',Buffer.alloc(0))]);
}
