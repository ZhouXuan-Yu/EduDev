import {pathToFileURL} from 'node:url';
import {withStaticOfficePage} from '../xiaozhi-agent/office-pdf-renderer';

/** Chromium renders the unmodified local Office SVG on white paper. The source
 * is an image data URL, with page scripts, network, navigation and downloads denied.
 */
export async function rasterWordDrawing(svg:Uint8Array,width:number,height:number,dataRoot:string,signal:AbortSignal):Promise<Buffer>{
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>9996||height>9996||(width+4)*(height+4)>20000000||!svg.length||svg.length>4*1048576)throw Error('too_large');
 const url='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
 const html=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; script-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"></head><body style="margin:0;background:white"></body></html>`;
 let blocked=false;
 return withStaticOfficePage(html,{dataRoot,signal,deadlineMs:30000,inlineResources:true,onBlockedResource:()=>{blocked=true;}},async({Window,htmlPath})=>{
  const window=new Window({show:false,width:800,height:600,webPreferences:{javascript:true,offscreen:true,backgroundThrottling:false}});
  await window.loadURL(pathToFileURL(htmlPath).href);
  const base64:unknown=await window.webContents.executeJavaScript(`(async()=>{
   const image=new Image();image.src=${JSON.stringify(url)};await image.decode();
   const canvas=document.createElement('canvas');canvas.width=${width+4};canvas.height=${height+4};
   const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('invalid_image');
   context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
   context.drawImage(image,2,2,${width},${height});
   const pixels=context.getImageData(2,2,${width},${height}).data;let content=false;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i]<255||pixels[i+1]<255||pixels[i+2]<255){content=true;break;}
   if(!content)throw Error('invalid_image');return canvas.toDataURL('image/png').split(',')[1];
  })()`);
  if(blocked||typeof base64!=='string'||base64.length>Math.ceil(4*1048576/3)*4)throw Error('invalid_image');
  const png=Buffer.from(base64,'base64');if(png.toString('base64')!==base64)throw Error('invalid_image');return png;
 });
}
