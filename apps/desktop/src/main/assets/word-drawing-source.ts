import {createHash} from 'node:crypto';
import type {WordDrawingRequest} from '../../shared/material-word-drawing';
import {MC_NS,WORD_NS,WP_NS,child,type WordNode} from './word-xml';

function* walk(node:WordNode):Generator<WordNode>{yield node;for(const child of node.children)yield* walk(child);}
export function wordDrawingNames(root:WordNode){
 const names=new Map<string,number>();
 for(const node of walk(root))if(WP_NS.has(node.uri)&&node.name==='docPr'&&node.attrs.name)names.set(node.attrs.name,(names.get(node.attrs.name)||0)+1);
 return names;
}
/** Only an independent geometry-only group can replace the existing atomic missing-image slot.
 * Text boxes, bitmap mixtures and OLE need separate layout/role evidence.
 */
export function wordDrawingRequest(node:WordNode,part:string,xml:string,names:Map<string,number>):WordDrawingRequest|undefined{
 if(part!=='word/document.xml'||node.uri!==MC_NS||node.name!=='AlternateContent')return;
 const fallback=child(node,'Fallback'),choice=child(node,'Choice');
 if(!fallback||!choice||fallback.children.length!==1||!WORD_NS.has(fallback.children[0].uri)||fallback.children[0].name!=='pict')return;
 const all=[...walk(node)],properties=[...walk(choice)].filter(n=>WP_NS.has(n.uri)&&n.name==='docPr');
 if(properties.length!==1)return;
 const placements=[...walk(choice)].filter(n=>WP_NS.has(n.uri)&&['inline','anchor'].includes(n.name));
 if(placements.length!==1)return;
 const name=properties[0].attrs.name;
 if(!name||name.length>256||names.get(name)!==1)return;
 if(all.some(n=>['txbxContent','blip','imagedata','textpath','OLEObject','sym','instrText','fldSimple','oMath','oMathPara','object','AlternateContent'].includes(n.name)&&n!==node))return;
 if(all.some(n=>WORD_NS.has(n.uri)&&n.name==='t'&&n.text.trim()))return;
 if(![...walk(fallback)].some(n=>n.uri==='urn:schemas-microsoft-com:vml'&&n.name==='group'))return;
 const raw=xml.slice(node.start,node.end);if(!raw||raw.length>128000)return;
 return {part,path:node.path,name,sha256:createHash('sha256').update(raw).digest('hex'),xml:raw,placement:placements[0].name==='inline'?'inline':'floating'};
}
