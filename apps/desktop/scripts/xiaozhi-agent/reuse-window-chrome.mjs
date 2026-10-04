import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root='D:/WorkProject/开源/ZCode';
const source='packages/desktop/src/main/desktopWindowButtonPosition.ts';
const output=path.join(desktop,'src/main/desktop-chrome/zcode-overlay.ts');
const manifest=path.join(desktop,'src/main/desktop-chrome/source.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(process.argv.includes('--verify')){
  const saved=JSON.parse(fs.readFileSync(manifest));
  if(sha(fs.readFileSync(path.join(root,saved.menuSource)))!==saved.menuSourceSha256)throw new Error('Referenced menu source changed');
  if(sha(fs.readFileSync(path.join(root,saved.zoomSource)))!==saved.zoomSourceSha256)throw new Error('Referenced zoom source changed');
  for(const row of saved.files)if(sha(fs.readFileSync(path.join(root,row.source)))!==row.sourceSha256||sha(fs.readFileSync(path.join(desktop,row.output)))!==row.outputSha256)throw new Error('Window source changed');
  console.log(JSON.stringify({success:true,files:saved.files.length,boundary:'Source evidence only'}));
}else{
  if(fs.existsSync(output)||fs.existsSync(manifest))throw new Error('Preserve existing output');
  const bytes=fs.readFileSync(path.join(root,source)),text=bytes.toString('utf8'),ast=ts.createSourceFile(source,text,ts.ScriptTarget.Latest,true);
  const names=['resolveWindowsTitleBarOverlayHeightForZoomLevel','buildWindowsTitleBarOverlayForZoomLevel'];
  const snippets=names.map(name=>{const node=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text===name);if(!node)throw new Error(name);return node.getText(ast);});
  const adapted='// Adapted from ZCode (Apache-2.0). Provenance in source.json and ZCODE-LICENSE.\nconst WINDOWS_TITLE_BAR_HEIGHT_PX = 36;\nconst resolveDesktopZoomFactorForLevel = (level: number) => 1.2 ** level;\n\n'+snippets.join('\n\n')+'\n';
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,adapted);
  const license=fs.readFileSync(path.join(root,'LICENSE')),licenseOutput=path.join(path.dirname(output),'ZCODE-LICENSE');fs.writeFileSync(licenseOutput,license);
  const menuSource='packages/desktop/src/main/desktopApplicationMenu.ts';
  const zoomSource='packages/desktop/src/main/desktopZoom.ts';
  fs.writeFileSync(manifest,JSON.stringify({date:'2026-10-03',license:'Apache-2.0',adaptation:'Original overlay functions extracted via TypeScript AST; 48px -> 36px screenshot baseline. Replace ZCode custom 1.1-step zoom-level conversion with Electron native 1.2**level, because this host passes getZoomLevel(). Menu pattern referenced, product commands localized.',menuSource,menuSourceSha256:sha(fs.readFileSync(path.join(root,menuSource))),zoomSource,zoomSourceSha256:sha(fs.readFileSync(path.join(root,zoomSource))),files:[{source,sourceSha256:sha(bytes),output:path.relative(desktop,output).replaceAll('\\','/'),outputSha256:sha(Buffer.from(adapted))},{source:'LICENSE',sourceSha256:sha(license),output:path.relative(desktop,licenseOutput).replaceAll('\\','/'),outputSha256:sha(license)}]},null,2));
  console.log(JSON.stringify({success:true,files:2}));
}
