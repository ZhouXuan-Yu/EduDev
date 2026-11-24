import type { PageBox } from '../../shared/material-page-preview';

export type RuledTableSlot={box:PageBox;rowSpan?:number;columnSpan?:number;covered?:true};
type Point=[row:number,column:number];

/** A connected component must be rectangular and contain no surviving interior rule. */
export function rectangularTableCells(grid:PageBox[][],horizontal:boolean[][],vertical:boolean[][]):RuledTableSlot[][]|undefined {
  const rows=grid.length,columns=grid[0].length;
  const slots=grid.map(row=>row.map((box):RuledTableSlot=>({box})));
  const visited=new Set<number>();
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    if(visited.has(row*columns+column))continue;
    const points:Point[]=[];
    const enqueue=(y:number,x:number)=>{
      const key=y*columns+x;
      if(visited.has(key))return;
      visited.add(key);points.push([y,x]);
    };
    enqueue(row,column);
    for(let i=0;i<points.length;i++){
      const [y,x]=points[i];
      if(y>0&&!horizontal[y][x])enqueue(y-1,x);
      if(y+1<rows&&!horizontal[y+1][x])enqueue(y+1,x);
      if(x>0&&!vertical[y][x])enqueue(y,x-1);
      if(x+1<columns&&!vertical[y][x+1])enqueue(y,x+1);
    }
    if(points.length===1)continue;
    const top=Math.min(...points.map(([y])=>y)),bottom=Math.max(...points.map(([y])=>y));
    const left=Math.min(...points.map(([,x])=>x)),right=Math.max(...points.map(([,x])=>x));
    const rowSpan=bottom-top+1,columnSpan=right-left+1;
    if(points.length!==rowSpan*columnSpan||points.some(([y,x])=>
      (y>top&&horizontal[y][x])||(x>left&&vertical[y][x])))return;
    for(const [y,x] of points)slots[y][x].covered=true;
    const first=grid[top][left],last=grid[bottom][right];
    slots[top][left]={box:[first[0],first[1],last[2],last[3]],rowSpan,columnSpan};
  }
  return slots;
}
