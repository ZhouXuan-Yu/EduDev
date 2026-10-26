declare module 'tinycolor2'{
 type Color={getAlpha:()=>number;setAlpha:(alpha:number)=>Color;toHex:()=>string;toHexString:()=>string};
 const tinycolor:(input:string)=>Color;export default tinycolor;
}
declare module 'svg-arc-to-cubic-bezier'{
 const arcToBezier:(input:{px:number;py:number;cx:number;cy:number;rx:number;ry:number;xAxisRotation:number;largeArcFlag:number;sweepFlag:number})=>Array<{x:number;y:number;x1:number;y1:number;x2:number;y2:number}>;
 export default arcToBezier;
}
