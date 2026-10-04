import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root='D:/WorkProject/开源/ZCode';
const source='packages/desktop/src/main/desktopWindowSize.ts';
const output='src/main/desktop-chrome/zcode-window-size.ts';
const manifest=path.join(desktop,'src/main/desktop-chrome/window-size-source.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
if(process.argv.includes('--verify')){
  const saved=JSON.parse(fs.readFileSync(manifest));
  for(const item of saved.files){
    if(sha(fs.readFileSync(path.join(root,item.source)))!==item.sourceSha256||sha(fs.readFileSync(path.join(desktop,item.output)))!==item.outputSha256)throw new Error('Window size source changed');
  }
  console.log(JSON.stringify({success:true,files:saved.files.length,boundary:'Static provenance only'}));
}else{
  if(fs.existsSync(manifest)||fs.existsSync(path.join(desktop,output)))throw new Error('Preserve existing source');
  const bytes=fs.readFileSync(path.join(root,source));
  const ast=ts.createSourceFile(source,bytes.toString('utf8'),ts.ScriptTarget.Latest,true);
  const names=['clampDimension','resolveDesktopWindowSize','WindowSizePersistenceTarget','attachDesktopWindowSizePersistence'];
  const nodes=names.map(name=>{const node=ast.statements.find(item=>item.name?.text===name);if(!node)throw new Error(name);return node.getText(ast);});
  const adapted=`// ZCode Apache-2.0: original AST-extracted functions and target type.\n// Source hashes, constants adaptation and license: window-size-source.json / ZCODE-LICENSE.\nimport type { BrowserWindow, Rectangle } from 'electron';\nexport const DEFAULT_DESKTOP_WINDOW_WIDTH = 1360;\nexport const DEFAULT_DESKTOP_WINDOW_HEIGHT = 900;\nexport const MIN_DESKTOP_WINDOW_WIDTH = 1100;\nexport const MIN_DESKTOP_WINDOW_HEIGHT = 720;\nconst WINDOW_SIZE_PERSIST_DEBOUNCE_MS = 250;\nexport type DesktopWindowSize = { width: number; height: number; maximized: boolean };\n\n${nodes.join('\n\n')}\n`;
  fs.writeFileSync(path.join(desktop,output),adapted);
  const license=fs.readFileSync(path.join(root,'LICENSE'));
  fs.writeFileSync(manifest,JSON.stringify({date:'2026-10-03',license:'Apache-2.0',adaptation:'AST function bodies and persistence target type unchanged; replace AppSettings alias by local equivalent and window constants by existing host dimensions. Host adapter supplies schema/display position and synchronous close flush; no extra dependency.',files:[{source,sourceSha256:sha(bytes),output,outputSha256:sha(Buffer.from(adapted))},{source:'LICENSE',sourceSha256:sha(license),output:'src/main/desktop-chrome/ZCODE-LICENSE',outputSha256:sha(license)}]},null,2));
  console.log(JSON.stringify({success:true,files:2}));
}
