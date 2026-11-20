import type {StructurePage, StructureQuestion} from '../../shared/material-document-structure';
import {
  QUESTION_STRUCTURE_ILLUSTRATIONS_SCHEMA, type CompleteQuestionDocument, type QuestionBlock,
} from '../../shared/question-document';
import {pageSha, validPageBox, type PageBox} from '../../shared/material-page-preview';
import type {OriginalImage} from './question-assets';

type ImageBlock = Extract<QuestionBlock, {kind:'image'}>;
export type StructureIllustrationPage = {page:StructurePage; image:OriginalImage; sha256:string};
export type StructureIllustrationPlan = {regionId:string; box:PageBox; blockId:string; parent:StructureIllustrationPage};
export type StructureIllustrationProof = {
  regionId:string; pageSha:string; rasterSha:string; block:ImageBlock;
};

const intersects = (a:PageBox,b:PageBox) => a[0]<b[2] && b[0]<a[2] && a[1]<b[3] && b[1]<a[3];
const inside = (a:PageBox,b:PageBox) => a[0]>=b[0] && a[1]>=b[1] && a[2]<=b[2] && a[3]<=b[3];
export function structureIllustrationAssets(q:StructureQuestion) {
  return q.assets.filter(a => !a.choiceLabel && (a.kind==='image' || a.kind==='chart'))
    .sort((a,b)=>a.page-b.page || a.box[1]-b.box[1] || a.box[0]-b.box[0] || a.regionId.localeCompare(b.regionId));
}

/** Only isolated figure regions that were already present in the reviewed body crop. */
export function planStructureIllustrations(
  q:StructureQuestion, document:CompleteQuestionDocument, parents:Map<number,StructureIllustrationPage>,
): StructureIllustrationPlan[] | undefined {
  const required=structureIllustrationAssets(q);
  if(!required.length || required.length>8 || q.issues.includes('missing_figure') ||
      new Set(required.map(a=>JSON.stringify([a.page,a.regionId]))).size!==required.length) return;
  const body=document.blocks.filter(b=>b.kind==='image'&&document.context.sourceBlockIds.includes(b.id));
  const result:StructureIllustrationPlan[]=[];
  for(const [index,asset] of required.entries()){
    const parent=parents.get(asset.page);
    if(!parent) throw Error('source_changed');
    const {page,image}=parent, box=asset.box;
    const regions=page.regions.filter(region=>region.id===asset.regionId);
    if(regions.length!==1 || !validPageBox(box) || !page.lines.every(line=>validPageBox(line.box))) return;
    const [region]=regions;
    const width=box[2]-box[0], height=box[3]-box[1];
    if(region.kind!==asset.kind || !Number.isFinite(region.score) || region.score<.75 ||
        JSON.stringify(region.box)!==JSON.stringify(box) ||
        width*image.width<32 || height*image.height<32 || width*height>.35 ||
        !body.some(b=>b.anchors.some(a=>a.page===asset.page&&inside(box,a.box)))) return;

    // A text line within the proposed image can be a diagram label. It must
    // already belong to the figure region and never to body/option/answer text.
    const ownLines=new Set(asset.lineIds ?? []);
    const prose=new Set(page.paragraphs.filter(p=>p.role!=='figure').flatMap(p=>p.lineIds));
    if(page.lines.some(line=>intersects(box,line.box)&&(
      !ownLines.has(line.id) || prose.has(line.id) || !inside(line.box,box)
    ))) return;
    const captionMargin:PageBox=[box[0],Math.max(0,box[1]-.012),box[2],Math.min(1,box[3]+.012)];
    if(page.regions.some(other=>other!==region&&(
      intersects(box,other.box) ||
      other.kind==='figure_title'&&intersects(captionMargin,other.box)
    ))) return;
    const blockId='structure_figure_'+(index+1);
    if(document.blocks.some(b=>b.id===blockId)) throw Error('source_changed');
    result.push({regionId:asset.regionId,box,parent,blockId});
  }
  return result;
}

export function validStructureIllustrationProof(v:unknown):v is StructureIllustrationProof[] {
  return Array.isArray(v)&&v.length>0&&v.length<=8&&v.every((entry,index)=>{
    const block=entry?.block;
    return entry&&Object.keys(entry).length===4&&
      typeof entry.regionId==='string'&&/^block-[1-9]\d{0,2}$/u.test(entry.regionId)&&
      pageSha(entry.pageSha)&&pageSha(entry.rasterSha)&&
      block?.kind==='image'&&block.id==='structure_figure_'+(index+1)&&block.mime==='image/png'&&
      pageSha(block.sha256)&&block.assetId==='asset_'+[block.sha256.slice(0,8),block.sha256.slice(8,12),
        block.sha256.slice(12,16),block.sha256.slice(16,20),block.sha256.slice(20,32)].join('-')&&
      [block.width,block.height].every(n=>Number.isInteger(n)&&n>=1&&n<=2401)&&
      Array.isArray(block.anchors)&&block.anchors.length===1&&
      Number.isInteger(block.anchors[0]?.page)&&validPageBox(block.anchors[0]?.box);
  });
}

export function assertStructureIllustrationPlan(plan:StructureIllustrationPlan[],proof:StructureIllustrationProof[]) {
  if(!validStructureIllustrationProof(proof)||plan.length!==proof.length||
      plan.some(({regionId,box,blockId,parent},index)=>{
        const saved=proof[index], {image}=parent, [anchor]=saved.block.anchors;
        return saved.regionId!==regionId || saved.pageSha!==parent.sha256 || saved.rasterSha!==image.sha256 ||
          saved.block.id!==blockId || anchor.page!==parent.page.page || JSON.stringify(anchor.box)!==JSON.stringify(box) ||
          saved.block.width!==Math.ceil(box[2]*image.width)-Math.floor(box[0]*image.width) ||
          saved.block.height!==Math.ceil(box[3]*image.height)-Math.floor(box[1]*image.height);
      })) throw Error('source_changed');
}

export function attachStructureIllustrations(document:CompleteQuestionDocument,proof:StructureIllustrationProof[]) {
  document.blocks.push(...proof.map(item=>item.block));
  document.context.illustrations={
    schemaVersion:QUESTION_STRUCTURE_ILLUSTRATIONS_SCHEMA, complete:true, blockIds:proof.map(item=>item.block.id),
  };
}
