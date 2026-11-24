import type { StructureLine, StructurePage, StructureTableSource } from "../../shared/material-document-structure";
import type { PageBox } from "../../shared/material-page-preview";
import { rectangularTableCells, type RuledTableSlot } from "./material-structure-table-topology";

type PixelRaster = { width: number; height: number; pixels: Buffer };
type Cell = StructureTableSource["rows"][number][number];
const maxPixels = 1_200_000;
const intersect = (a: PageBox, b: PageBox) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

function bands(start: number, end: number, matches: (position: number) => boolean) {
  const runs: number[] = [];
  let run = -1;
  for (let position = start; position <= end; position++) {
    if (position < end && matches(position)) {
      if (run < 0) run = position;
    } else if (run >= 0) {
      if (position - run > 14) return [];
      runs.push(Math.floor((run + position - 1) / 2));
      run = -1;
    }
  }
  return runs;
}

/** Reconstruct cells from confirmed separators, including rectangular merged cells. */
export function ruledTableLayout(raster: PixelRaster, region: PageBox): RuledTableSlot[][] | undefined {
  const { width, height, pixels } = raster;
  const [l, t, r, b] = [region[0] * width, region[1] * height, region[2] * width, region[3] * height];
  const margin = Math.ceil(Math.min(12, Math.max(5, (b - t) * .10)));
  const left = Math.max(2, Math.floor(l) - margin), right = Math.min(width - 2, Math.ceil(r) + margin);
  const top = Math.max(2, Math.floor(t) - margin), bottom = Math.min(height - 2, Math.ceil(b) + margin);
  const spanX = right - left, spanY = bottom - top;
  if (spanX < 48 || spanY < 34 || spanX * spanY > maxPixels || pixels.length !== width * height * 4) return;
  const dark = new Uint8Array(spanX * spanY);
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const at = (y * width + x) * 4;
    if (pixels[at + 3] >= 200 && Math.max(pixels[at], pixels[at + 1], pixels[at + 2]) < 155)
      dark[(y - top) * spanX + x - left] = 1;
  }
  const inkAt=(horizontal:boolean,fixed:number,vary:number)=>{
    const extent = horizontal ? spanY : spanX;
    for(let sample=Math.max(0,fixed-2);sample<=Math.min(extent-1,fixed+2);sample++){
      if(dark[horizontal?sample*spanX+vary:vary*spanX+sample])return true;
    }
    return false;
  };
  const ratio = (horizontal: boolean, fixed: number, first: number, last: number) => {
    let found=0;
    for(let vary=first;vary<last;vary++)if(inkAt(horizontal,fixed,vary))found++;
    return found/(last-first);
  };
  const closeOuter = (axis: number[], start: number, end: number, span: number) =>
    axis.length >= 2 && Math.abs(axis[0] - start) <= span * .06 + 5 && Math.abs(axis.at(-1)! - end) <= span * .06 + 5 &&
    axis.every((position, index) => index === 0 || position - axis[index - 1] >= 11);
  const ys = bands(0, spanY, y => ratio(true, y, 0, spanX) >= .68);
  if (ys.length > 13 || !closeOuter(ys, t - top, b - top, spanY)) return;
  const xs = bands(0, spanX, x => ratio(false, x, ys[0], ys.at(-1)!) >= .68);
  if (xs.length > 17 || !closeOuter(xs, l - left, r - left, spanX)) return;
  const localGuides = (horizontal: boolean, across: number[], complete: number[], extent: number, bothEnds: boolean) =>
    across.slice(1).flatMap((end, index) => {
      const start = across[index];
      const junction = Math.min(8, Math.floor((end - start - 6) / 2));
      return bands(complete[0], complete.at(-1)! + 1,
        position => position < extent && ratio(horizontal, position, start, end) >= .77)
        .filter(position => {
          if(complete.some(guide=>Math.abs(guide-position)<=6))return false;
          // Sample inside the cell so the crossing rule itself cannot count as a connection.
          const first=ratio(horizontal,position,start+3,start+3+junction)>=.66;
          const last=ratio(horizontal,position,end-3-junction,end-3)>=.66;
          return bothEnds?first&&last:first||last;
        });
    });
  const addGuides=(guides:number[],candidates:number[])=>{
    for(const candidate of candidates)if(guides.every(guide=>Math.abs(candidate-guide)>6))guides.push(candidate);
    guides.sort((a,b)=>a-b);
  };
  addGuides(xs,localGuides(false,ys,xs,spanX,true));
  addGuides(ys,localGuides(true,xs,ys,spanY,true));
  if(xs.length<3||ys.length<3||xs.length>17||ys.length>13||
    !closeOuter(xs,l-left,r-left,spanX)||!closeOuter(ys,t-top,b-top,spanY)||(xs.length-1)*(ys.length-1)>96)return;
  if(localGuides(false,ys,xs,spanX,false).length||localGuides(true,xs,ys,spanY,false).length)return;

  const edge=(horizontal:boolean,position:number,start:number,end:number,outer:boolean)=>{
    if(ratio(horizontal,position,start,end)>=.56)return true;
    if(outer||ratio(horizontal,position,start+3,end-3)>.22)return;
    // Text can cross an imaginary separator. A remaining rule must not be merged away.
    const junction=Math.min(5,Math.floor((end-start-6)/2));
    if(ratio(horizontal,position,start+3,start+3+junction)>=.8||
      ratio(horizontal,position,end-3-junction,end-3)>=.8)return;
    const maxStroke=Math.max(7,Math.round((end-start)*.12));
    let contiguous=0;
    for(let vary=start+3;vary<end-3;vary++){
      contiguous=inkAt(horizontal,position,vary)?contiguous+1:0;
      if(contiguous>=maxStroke)return;
    }
    return false;
  };
  const horizontal=ys.map((y,index)=>xs.slice(1).map((end,column)=>edge(true,y,xs[column],end,index===0||index===ys.length-1)));
  const vertical=ys.slice(1).map((end,row)=>xs.map((x,index)=>edge(false,x,ys[row],end,index===0||index===xs.length-1)));
  if([...horizontal,...vertical].some(row=>row.includes(undefined)))return;
  const grid=ys.slice(1).map((down, row) => xs.slice(1).map((across, col):PageBox => [
    (left + xs[col]) / width, (top + ys[row]) / height, (left + across) / width, (top + down) / height,
  ]));
  return rectangularTableCells(grid,horizontal.map(row=>row.map(Boolean)),vertical.map(row=>row.map(Boolean)));
}

export function ruledTableGrid(raster: PixelRaster, region: PageBox): PageBox[][] | undefined {
  const layout=ruledTableLayout(raster,region);
  if(layout&&!layout.some(row=>row.some(slot=>slot.covered)))return layout.map(row=>row.map(slot=>slot.box));
}

/** Hold line boxes dominated by pale chromatic ink, even if OCR is confident about that ink. */
export function paleChromaticReading(raster: PixelRaster, box: PageBox) {
  const { width, height, pixels } = raster;
  const left = Math.max(0, Math.floor(box[0] * width)), right = Math.min(width, Math.ceil(box[2] * width));
  const top = Math.max(0, Math.floor(box[1] * height)), bottom = Math.min(height, Math.ceil(box[3] * height));
  const area = (right - left) * (bottom - top);
  if (left >= right || top >= bottom || area > maxPixels) return false;
  let foreground = 0, paleColor = 0, darkNeutral = 0;
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    const i = (y * width + x) * 4;
    if (pixels[i + 3] < 200) continue;
    const high = Math.max(pixels[i], pixels[i + 1], pixels[i + 2]);
    const low = Math.min(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (low >= 238 || high >= 253) continue;
    foreground++;
    const chroma = high - low;
    if (high >= 165 && chroma >= 14) paleColor++;
    if (high < 155 && chroma < 24) darkNeutral++;
  }
  return paleColor >= Math.max(12, area * .04) && paleColor >= foreground * .44 &&
    darkNeutral <= paleColor * .45;
}

function evidenceForCell(box:PageBox, lines:StructureLine[], raster?:PixelRaster):Cell{
    const byCoverage = lines.map(line => ({ line, coverage: intersect(line.box, box) / intersect(line.box, line.box) }));
    const owned = byCoverage.filter(({coverage}) => coverage >= .88).map(({line}) => line)
      .sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
    const overlap = owned.some((line, index) => owned.slice(index + 1).some(next =>
      intersect(line.box, next.box) / Math.min(intersect(line.box, line.box), intersect(next.box, next.box)) >= .28));
    const overprint = raster && owned.some(line => paleChromaticReading(raster, line.box));
    const strong = !overlap && !overprint && owned.filter(line => line.score >= .92 && !!line.text.trim());
    return { box, text: strong ? strong.map(line => line.text).join("\n") : "",
      lineIds: owned.map(line => line.id), ...(overprint && { suspectedOverprint: true as const }), needsReview: !strong || !strong.length || strong.length !== owned.length ||
        byCoverage.some(({coverage}) => coverage >= .22 && coverage < .88) };
}

export function evidenceForTable(grid: PageBox[][], lines: StructureLine[], raster?: PixelRaster): Cell[][] {
  return grid.map(row=>row.map(box=>evidenceForCell(box,lines,raster)));
}

export function readStructureTables(page: StructurePage, getRaster: () => PixelRaster): StructureTableSource[] {
  const regions = page.regions.filter(region => region.kind === "table" && region.score >= .7).slice(0, 8);
  if (!regions.length || page.issues.includes("ambiguous_columns")) return [];
  const raster = getRaster();
  return regions.flatMap(region => {
    const lines = page.lines.filter(line => line.regionIds.includes(region.id) && !line.origin);
    const layout = ruledTableLayout(raster, region.box);
    if (!layout || !lines.length) return [];
    const rows=layout.map(row=>row.map(({box,rowSpan,columnSpan,covered}):Cell=>{
      if(covered)return {box,covered:true,text:"",lineIds:[],needsReview:false};
      return {...evidenceForCell(box,lines,raster),...(rowSpan&&columnSpan?{rowSpan,columnSpan}:{})};
    }));
    return [{ regionId: region.id, page: page.page, box: region.box, rasterSha256: page.rasterSha256,
      rows }];
  });
}
