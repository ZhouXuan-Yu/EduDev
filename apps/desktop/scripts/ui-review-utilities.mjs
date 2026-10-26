import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {compile} from 'tailwindcss';
import postcss from 'postcss';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const desktop=path.resolve(import.meta.dirname,'..');
const candidates=new Set();
const dirs=['design-review','heroui-pro/components/chain-of-thought','heroui-pro/components/prompt-input','heroui-pro/components/chat-message'];
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
 const p=path.join(dir,entry.name);
 if(entry.isDirectory())scan(p);
 else if(/\.(ts|tsx)$/.test(p)){
  const file=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(n){if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateHead(n)||ts.isTemplateMiddle(n)||ts.isTemplateTail(n))for(const word of n.text.split(/\s+/))if(word)candidates.add(word);ts.forEachChild(n,visit);}visit(file);
 }
}}
for(const dir of dirs)scan(path.join(desktop,'src/renderer',dir));
const theme=fs.readFileSync(require.resolve('tailwindcss/theme.css'),'utf8').replace('@theme default','@theme reference');
const compiler=await compile(theme+'\n@theme inline {--color-foreground:var(--foreground);--color-muted:var(--muted);--color-surface:var(--surface);--color-default:var(--default);}\n@tailwind utilities;');
const root=postcss.parse(compiler.build([...candidates]));
const layer=postcss.atRule({name:'layer',params:'utilities'});
const scope=postcss.atRule({name:'scope',params:'(.review-root)'});
for(const node of [...root.nodes]){
 if(node.type==='comment'||node.type==='atrule'&&node.name==='layer'&&!node.nodes){node.remove();continue;}
 if(node.type==='atrule'&&node.name==='property')continue;
 scope.append(node);
}
layer.append(scope);root.append(layer);
fs.writeFileSync(path.join(desktop,'src/renderer/design-review/reference.utilities.css'),'/* Generated required official example utilities, review scope only. No preflight or theme override. */\n'+root.toString());
console.log('Generated scoped reference utilities; official source configuration unchanged.');
