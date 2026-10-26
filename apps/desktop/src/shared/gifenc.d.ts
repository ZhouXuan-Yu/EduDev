declare module 'gifenc' {
 export function quantize(rgba:Uint8Array,maxColors:number):number[][];
 export function applyPalette(rgba:Uint8Array,palette:number[][]):Uint8Array;
 export function GIFEncoder():{writeFrame(index:Uint8Array,width:number,height:number,options:{palette:number[][];delay:number;repeat?:number}):void;finish():void;bytes():Uint8Array};
 const gifenc:{GIFEncoder:typeof GIFEncoder;quantize:typeof quantize;applyPalette:typeof applyPalette};
 export default gifenc;
}
