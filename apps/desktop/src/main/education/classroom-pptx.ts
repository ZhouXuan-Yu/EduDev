import PptxGenJS from 'pptxgenjs';
import type {PPTShapeElement} from '@openmaic/dsl';
import {getLineElementPath,getElementRange} from '@openmaic/renderer';
import {toPoints} from './vendor/openmaic/export/svg-path-parser';
import {formatHTML,formatPoints,formatColor,getShadowOption,getOutlineOption} from './vendor/openmaic/export/pptx-format';
import type {ClassroomOfficeSource} from '../../shared/classroom-export';
import {containsOfficeMath} from '../../shared/office-math';
import {OFFICE_DRAFT_SCHEMA} from '../../shared/xiaozhi-office-draft';
/** Pure upstream geometry/format adaptation. Bytes go to the existing Office approval host. */
export async function generateClassroomPptx(source:ClassroomOfficeSource,options:{dataRoot:string;signal?:AbortSignal}):Promise<Buffer>{
 const doc=source.document,pptx=new PptxGenJS();pptx.author='小智';pptx.title=doc.title;pptx.subject='教师确认课堂 · 公式为不可编辑图片';
 const scenes=doc.scenes.filter(s=>s.type==='slide');const first=scenes[0];if(first?.type!=='slide')throw Error('invalid_input');
 const size=first.content.canvas.viewportSize,ratio=first.content.canvas.viewportRatio;
 if(scenes.some(s=>s.type==='slide'&&(s.content.canvas.viewportSize!==size||s.content.canvas.viewportRatio!==ratio)))throw Error('unsupported');
 pptx.defineLayout({name:'CLASSROOM',width:10,height:10*ratio});pptx.layout='CLASSROOM';
 const pxInch=size/10,pxPt=pxInch/72;
 const formulas=scenes.flatMap(s=>s.type==='slide'?s.content.canvas.elements.filter(e=>e.type==='latex'):[]);
 const math=formulas.length?await(await import('../xiaozhi-agent/office-pdf-renderer')).renderOfficeMathImages({schemaVersion:OFFICE_DRAFT_SCHEMA,title:'本地课堂公式',sections:formulas.map(e=>({heading:e.id,paragraphs:[e.type==='latex'?`$${e.latex}$`:'']}))},{...options,cropMath:true}):new Map();
 let formulaIndex=0;
 for(const scene of doc.scenes){
  options.signal?.throwIfAborted();
  if(scene.type==='quiz'){
   for(const [index,q] of scene.content.questions.entries()){
    const values=[q.question,...(q.options||[]).map(o=>`${o.value}. ${o.label}`),...(source.includeAnswers?[`参考答案：${q.answer?.join('、')}`,`解析：${q.analysis}`]:[])];
    if(values.some(containsOfficeMath))throw Error('unsupported');
    const slide=pptx.addSlide();slide.addText(`${scene.title} · ${index+1}`,{x:.4,y:.2,w:9.2,h:.5,fontFace:'Microsoft YaHei',fontSize:22,bold:true,margin:0});
    slide.addTable(values.map(text=>[{text}]),{x:.4,y:.9,w:9.2,h:10*ratio-1.2,fontFace:'Microsoft YaHei',fontSize:16,margin:.06,border:{type:'none'},autoPage:true,autoPageSlideStartY:.9,autoPageLineWeight:.4});
   }
   continue;
  }
  if(scene.type!=='slide')throw Error('unsupported');const slide=pptx.addSlide();
  const canvas=scene.content.canvas;if(canvas.background?.type&&canvas.background.type!=='solid')throw Error('unsupported');
  if(canvas.background?.color)slide.background={color:formatColor(canvas.background.color).color};
  for(const el of canvas.elements){
   options.signal?.throwIfAborted();
   if(el.type==='text'){
    slide.addText(formatHTML(el.content,pxPt),{x:el.left/pxInch,y:el.top/pxInch,w:el.width/pxInch,h:el.height/pxInch,fontSize:16/pxPt,fontFace:el.defaultFontName||'Microsoft YaHei',color:formatColor(el.defaultColor||'#000').color,valign:'top',margin:10/pxPt,paraSpaceBefore:(el.paragraphSpace??5)/pxPt,lineSpacingMultiple:(el.lineHeight??1.5)/1.25,rotate:el.rotate,transparency:el.opacity===undefined?undefined:(1-el.opacity)*100,fill:el.fill?{color:formatColor(el.fill).color}:undefined,shadow:el.shadow?getShadowOption(el.shadow,pxPt):undefined,line:el.outline?.width?getOutlineOption(el.outline,pxPt):undefined,charSpacing:el.wordSpace?el.wordSpace/pxPt:undefined,vert:el.vertical?'eaVert':undefined});
   }else if(el.type==='shape'){
    if(el.pattern||el.gradient)throw Error('unsupported');const points=toPoints(el.path);if(!points.length)throw Error('unsupported');
    if(!el.viewBox?.every(v=>Number.isFinite(v)&&v>0))throw Error('unsupported');
    const fill=formatColor(el.fill);slide.addShape('custGeom' as PptxGenJS.ShapeType,{x:el.left/pxInch,y:el.top/pxInch,w:el.width/pxInch,h:el.height/pxInch,points:formatPoints(points,pxInch,{x:el.width/el.viewBox[0],y:el.height/el.viewBox[1]}),fill:{color:fill.color,transparency:(1-fill.alpha*(el.opacity??1))*100},line:el.outline?.width?getOutlineOption(el.outline,pxPt):{transparency:100},rotate:el.rotate,flipH:el.flipH,flipV:el.flipV,shadow:el.shadow?getShadowOption(el.shadow,pxPt):undefined});
    const overlay=(el as PPTShapeElement).text;if(overlay)slide.addText(formatHTML(overlay.content,pxPt),{x:el.left/pxInch,y:el.top/pxInch,w:el.width/pxInch,h:el.height/pxInch,fontFace:overlay.defaultFontName||'Microsoft YaHei',fontSize:16/pxPt,color:formatColor(overlay.defaultColor||'#000').color,valign:overlay.align,rotate:el.rotate});
   }else if(el.type==='line'){
    const path=getLineElementPath(el),range=getElementRange(el),points=toPoints(path);if(!points.length)throw Error('unsupported');const c=formatColor(el.color);
    slide.addShape('custGeom' as PptxGenJS.ShapeType,{x:range.minX/pxInch,y:range.minY/pxInch,w:(range.maxX-range.minX)/pxInch,h:(range.maxY-range.minY)/pxInch,points:formatPoints(points,pxInch,undefined,{x:range.minX-el.left,y:range.minY-el.top}),line:{color:c.color,transparency:(1-c.alpha)*100,width:el.width/pxPt,dashType:el.style==='dashed'?'dash':el.style==='dotted'?'sysDot':'solid',beginArrowType:el.points?.[0]?'arrow':'none',endArrowType:el.points?.[1]?'arrow':'none'},shadow:el.shadow?getShadowOption(el.shadow,pxPt):undefined});
   }else if(el.type==='latex'){
    const image=math.get(`${formulaIndex++}:0`);if(!image)throw Error('unsupported');
    slide.addImage({data:'image/png;base64,'+image.bytes.toString('base64'),x:el.left/pxInch,y:el.top/pxInch,w:el.width/pxInch,h:el.height/pxInch,altText:'公式（不可编辑）：'+el.latex});
   }else throw Error('unsupported');
  }
  slide.addNotes(`课堂版本 ${source.revision}；公式为本地排版图片，不可编辑；教学与答案仍需教师核对。`);
 }
 options.signal?.throwIfAborted();return Buffer.from(await pptx.write({outputType:'nodebuffer',compression:true}) as Buffer);
}
