import type {WordAsset} from '../../shared/material-word';
import {WORD_PREAMBLE_MAX_DIMENSION,WORD_PREAMBLE_MAX_IMAGE_BYTES} from '../../shared/material-word';

/** Electron bitmaps are BGRA. Every pixel must be opaque and near white. */
export function isBlankWordBitmap(bitmap:Uint8Array,width:number,height:number){
 if(width<1||height<1||bitmap.length!==width*height*4)return false;
 for(let offset=0;offset<bitmap.length;offset+=4){
  if(bitmap[offset]<254||bitmap[offset+1]<254||bitmap[offset+2]<254||bitmap[offset+3]!==255)return false;
 }
 return true;
}

export function isStaticWordPreamblePng(asset:Pick<WordAsset,'width'|'height'>,bytes:Buffer){
 const signature=Buffer.from([137,80,78,71,13,10,26,10]);
 if(asset.width<1||asset.height<1||asset.width>WORD_PREAMBLE_MAX_DIMENSION||asset.height>WORD_PREAMBLE_MAX_DIMENSION||
    bytes.length<33||bytes.length>WORD_PREAMBLE_MAX_IMAGE_BYTES||!bytes.subarray(0,8).equals(signature)||
    bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR'||
    bytes.readUInt32BE(16)!==asset.width||bytes.readUInt32BE(20)!==asset.height)return false;
 for(let offset=8;offset+12<=bytes.length;){
  const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8);
  offset+=12+length;
  if(offset>bytes.length||type==='acTL'||type==='fcTL'||type==='fdAT')return false;
  if(type==='IEND')return length===0&&offset===bytes.length;
 }
 return false;
}

export async function inspectBlankWordPng(asset:WordAsset,bytes:Buffer){
 if(!isStaticWordPreamblePng(asset,bytes))return false;
 const {nativeImage}=await import('electron');
 const image=nativeImage.createFromBuffer(bytes),{width,height}=image.getSize();
 return !image.isEmpty()&&width===asset.width&&height===asset.height&&isBlankWordBitmap(image.toBitmap(),width,height);
}
