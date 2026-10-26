import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const postcss=createRequire(import.meta.url)('postcss');

export function styleInventory(rendererRoot){
 const rules=[],files=[],official=[];
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(file.endsWith('.css')){
  const bytes=fs.readFileSync(file),relative=path.relative(rendererRoot,file).replaceAll('\\','/');
  const record={file:relative,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  if(relative.startsWith('heroui-pro/')){official.push(record);continue;}files.push(record);
  postcss.parse(bytes.toString('utf8'),{from:file}).walkRules(rule=>{
   const tokens=rule.nodes.filter(n=>n.type==='decl'&&/^--(?:accent|muted|surface|background|foreground|field|border|focus)/.test(n.prop));
   const component=/data-slot|\.(?:button|chat-message|chat-tool|chain-of-thought|text-shimmer|prompt-input|chat-list-view|app-layout)(?:_|--|\b)/.test(rule.selector);
   const interaction=/:hover|:focus|:active|data-(?:hovered|pressed|focus-visible)/.test(rule.selector);
   const important=rule.nodes.filter(n=>n.type==='decl'&&n.important);
   if(tokens.length||component||interaction||important.length)rules.push({file:relative,line:rule.source.start.line,selector:rule.selector,component,interaction,tokens:tokens.map(n=>({name:n.prop,value:n.value})),important:important.map(n=>({name:n.prop,value:n.value}))});
  });
 }}}
 walk(rendererRoot);return{files,official,rules,counts:{applicationFiles:files.length,officialFiles:official.length,rules:rules.length,componentOverrides:rules.filter(r=>r.component).length,tokenBindings:rules.filter(r=>r.tokens.length).length,interactiveRules:rules.filter(r=>r.interaction).length,importantRules:rules.filter(r=>r.important.length).length}};
}
