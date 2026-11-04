import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer, transformWithEsbuild } from 'vite';
import { transform } from 'esbuild';
import { chromium } from 'playwright';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const out = fs.mkdtempSync(path.join(fs.realpathSync('test-results'), 'ui-final-material-catalog-ui-'));
const hash = v => createHash('sha256').update(v).digest('hex');
const report = {
    success: false, phase: 'PREPARE', checks: [], errors: [], geometry: [], output: out, modelCalls: 0, electron: false, productAcceptance: false, seams: ['Headless Chromium runs production Workspace/Filters/MetadataEditor/TextSearch and official HeroUI with frozen baseline CSS plus current own modules and unchanged native boundary.', 'In-memory typed API fixture exercises renderer state only; native SQLite/Lance results are in the separate focused test.', 'Unrelated body/import/diagnostics components are inert harness placeholders; no business capability is replaced in production.']
};
report.sourceFingerprints=Object.fromEntries(["src/shared/material-catalog.ts","src/main/assets/material-catalog.ts","src/main/assets/material-catalog-ipc.ts","src/main/db.ts","src/main/assets/material-ipc.ts","src/preload/index.ts","src/renderer/components/product/MaterialsWorkspace.tsx","src/renderer/components/product/MaterialCatalogFilters.tsx","src/renderer/components/product/MaterialCatalogMetadataEditor.tsx","src/renderer/ui-system/material-catalog.module.css","src/renderer/components/product/MaterialTextSearch.tsx","src/main/assets/material-full-text.ts","src/main/retrieval/repository.ts","src/shared/retrieval.ts","src/main/retrieval/vector-store.ts"].map(file=>[file,hash(fs.readFileSync(file))]));
report.testFingerprint=hash(fs.readFileSync(fileURLToPath(import.meta.url)));
const check = async (code, fn) => {
    report.phase = code;
    try {
        await fn();
        report.checks.push({ code, status: 'PASS' });
    }
    catch (e) {
        report.checks.push({
            code, status: 'FAIL', hash: hash(String(e)), site: String(e.stack).match(/material-catalog-ui-focused-test\.mjs:\d+:\d+/)?.[0]
        });
        throw e;
    }
};
const boundary = await transform(fs.readFileSync('scripts/css-native-boundary.ts', 'utf8'), { loader: 'ts', format: 'esm' });
fs.writeFileSync(path.join(out, 'boundary.mjs'), boundary.code, { flag: 'wx' });
const { nativeComponentBoundary } = await import(pathToFileURL(path.join(out, 'boundary.mjs')));
const pins = JSON.parse(fs.readFileSync('test-results/ui-final-resumed-00Hhv6-pins.json', 'utf8'));
const assets = path.join(pins.buildRoot, 'renderer/assets'), assetNames = fs.readdirSync(assets);
const baselineCss = {
    app: assetNames.find(n => /^index-.*\.css$/.test(n)), hero: assetNames.find(n => /^heroui-pro-.*\.css$/.test(n))
};
assert(baselineCss.app && baselineCss.hero);
report.cssBaseline = { build: pins.build, source: pins.source, currentComponentsAndOwnModules: true };
const entry = `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';

import {DesktopFrame,useDesktopNavigation} from '/src/renderer/components/desktop/DesktopFrame.tsx';
import {MaterialsWorkspace} from '/src/renderer/components/product/MaterialsWorkspace.tsx';
import {MaterialCatalogMetadataEditor} from '/src/renderer/components/product/MaterialCatalogMetadataEditor.tsx';
const schema='xiaozhi.material-catalog.v1',version='a'.repeat(64),params=new URLSearchParams(location.search);
const id=i=>'resource_'+String(i).padStart(8,'0')+'-0000-0000-0000-000000000000';
const rows=Array.from({length:151},(_,i)=>({id:id(i),title:'资料'+i,resourceType:'document',originalFileName:'lesson-'+i+'.'+(i%2?'txt':'pdf'),localPath:'owned/synthetic-'+i,fileSize:123,contentHash:version,parseStatus:'ready',parseEngine:'fixture',chunkCount:1,createdAt:'fixture',updatedAt:'fixture'}));
const organizations=new Map(rows.map((r,i)=>[r.id,{schemaVersion:schema,resourceId:r.id,sourceVersion:version,revision:0,metadata:{directory:i<100?'目录A':'目录B',tags:i%2?['练习']:['物理','实验']},receipt:null}]));
window.harness={calls:[],heldLists:[],heldReads:[],heldBody:[],holdList:false,holdRead:false,holdBody:false,lostReply:false,readFail:false,saveCount:0};const h=window.harness;
const snapshot=v=>structuredClone(v),key=v=>v.normalize('NFKC').trim().toLowerCase();
const facets={directories:[{value:'目录A',count:100},{value:'目录B',count:51}],tags:[{value:'物理',count:76},{value:'实验',count:76},{value:'练习',count:75}],formats:[{value:'PDF',count:76},{value:'TXT',count:75}],states:[{value:'ready',count:151}]};
const api={
 getDesktopChrome:async()=>({enabled:false,platform:'win32',zoomFactor:1,maximized:false,height:44}),onDesktopChrome:()=>()=>{},onDesktopCommand:()=>()=>{},
 getMaterialJob:async()=>({schemaVersion:'xiaozhi.materials.v1',active:false}),getMaterialQueue:async()=>({running:0,pending:0,invalid:0,tasks:[]}),
 listMaterialCatalog:async q=>{h.calls.push({name:'list',input:snapshot(q)});const result=rows.filter(r=>{const m=organizations.get(r.id).metadata;return (q.scope.directory===null||key(m.directory)===key(q.scope.directory))&&q.scope.tags.every(t=>m.tags.some(v=>key(v)===key(t)))&&(!q.scope.format||r.originalFileName.toUpperCase().endsWith('.'+q.scope.format))&&(!q.query||r.title.includes(q.query));});const page={schemaVersion:schema,items:result.slice(q.offset,q.offset+50).map(resource=>({resource,organization:snapshot(organizations.get(resource.id))})),total:result.length,offset:q.offset,hasMore:q.offset+50<result.length,facets};if(h.holdList)return new Promise(resolve=>h.heldLists.push(()=>resolve(page)));return page;},
 getMaterialCatalogMetadata:async q=>{h.calls.push({name:'read',input:snapshot(q)});if(h.readFail)throw Error('READ_FAILURE');const value=snapshot(organizations.get(q.resourceId));if(value.sourceVersion!==q.sourceVersion)throw Error('source_changed');if(h.holdRead)return new Promise(resolve=>h.heldReads.push(()=>resolve(value)));return value;},
 saveMaterialCatalogMetadata:async q=>{h.calls.push({name:'save',input:snapshot(q)});h.saveCount++;const prior=organizations.get(q.resourceId);if(prior.revision!==q.expectedRevision)throw Error('revision_conflict');const value={...prior,revision:prior.revision+1,metadata:snapshot(q.metadata),receipt:{operationId:q.operationId,baseRevision:q.expectedRevision,sourceVersion:q.sourceVersion,patchDigest:'f'.repeat(64)}};organizations.set(q.resourceId,value);if(h.lostReply)throw Error('ACK_LOST');return snapshot(value);},
 searchMaterialCatalogBody:async q=>{h.calls.push({name:'body',input:snapshot(q)});const value={schemaVersion:'xiaozhi.material-search.v1',hits:[{title:'合成正文',excerpt:'BODY-'+q.scope.directory,source:{schemaVersion:'xiaozhi.material-source.v1',resourceId:id(0),version,offset:0,chunkId:'chunk_00000000-0000-0000-0000-000000000000',bodyVersion:version},citation:'合成来源'}],offset:q.offset,hasMore:false,index:{available:true,indexed:151,pending:0},catalogScope:q.scope,scopeStamp:'f'.repeat(64),actualMode:'keyword',semantic:{available:false,complete:false,reason:'scope_candidate_limit',candidateLimit:100,exhausted:false,pending:0,failed:0,backfilling:false,generation:''}};if(h.holdBody)return new Promise(resolve=>h.heldBody.push(()=>resolve(value)));return value;},
 getMaterialIndexStatus:async()=>({available:true,indexed:151,pending:0}),
};
window.omniEdu=new Proxy(api,{get(t,k){if(!(k in t))return()=>{throw Error('UNDECLARED_API');};return t[k];}});
function Fixture(){const navigation=useDesktopNavigation();h.navigate=view=>navigation.navigate({view});h.target=navigation.target.view;const [resource,setResource]=useState(rows[0]),[revision,setRevision]=useState(0);h.select=i=>setResource(rows[i]);h.refresh=()=>setRevision(v=>v+1);return navigation.target.view==='settings'?<p data-testid="left-fixture">已离开资料</p>:params.get('mode')==='editor'?<MaterialCatalogMetadataEditor resource={resource} revision={revision} onDirty={v=>h.blocked=v} onSaved={()=>h.saved=true}/>:<><button data-testid="outside-probe" onClick={()=>h.externalClicks=(h.externalClicks||0)+1}>外部导航测试入口</button><MaterialsWorkspace/></>;}
document.documentElement.setAttribute('data-edu-modern','');document.documentElement.dataset.theme='light';
createRoot(document.getElementById('fixture-root')).render(<DesktopFrame><Fixture/></DesktopFrame>);`;
let browser, page, server;
try {
    server = await createServer({
        root, configFile: false, appType: 'custom', cacheDir: path.join(out, 'vite-cache'), esbuild: { jsx: 'automatic' }, css: { postcss: { plugins: [nativeComponentBoundary(path.join(root, 'src/renderer'))] } }, optimizeDeps: {
            entries: [], noDiscovery: true, include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@heroui/react', 'lucide-react']
        }, plugins: [{
                name: 'catalog-fixture', enforce: 'pre', resolveId(id, importer) {
                    if (id === '/__catalog.jsx')
                        return '\0catalog-fixture';
                    if (importer?.endsWith('/MaterialsWorkspace.tsx')) {
                        const name = id.replace('./', '');
                        if (['MaterialBodyPanel', 'MaterialImportPanel', 'MaterialQuestionStatus', 'RetrievalProgress'].includes(name))
                            return '\0inert-' + name;
                    }
                }, async load(id) {
                    if (id === '\0catalog-fixture')
                        return transformWithEsbuild(entry, 'catalog-fixture.jsx', { loader: 'jsx', jsx: 'automatic' });
                    if (id.startsWith('\0inert-'))
                        return 'export const ' + id.slice('\0inert-'.length) + '=()=>null;';
                }, configureServer(s) {
                    s.middlewares.use((req, res, next) => {
                        const route = req.url?.split('?')[0];
                        if (route === '/__app.css' || route === '/__hero.css') {
                            res.setHeader('Content-Type', 'text/css');
                            res.end(fs.readFileSync(path.join(assets, route === '/__app.css' ? baselineCss.app : baselineCss.hero)));
                            return;
                        }
                        if (route !== '/fixture')
                            return next();
                        res.setHeader('Content-Type', 'text/html');
                        res.end('<!doctype html><html><head><link rel="stylesheet" href="/__hero.css"><link rel="stylesheet" href="/__app.css"><style>html,body{margin:0}#fixture-main{box-sizing:border-box;margin-left:248px;width:calc(100% - 248px);padding:24px;min-width:0} @media(max-width:900px){#fixture-main{margin-left:200px;width:calc(100% - 200px);padding:16px}}</style></head><body><main id="fixture-main"><div id="fixture-root"></div></main><script type="module" src="/__catalog.jsx"></script></body></html>');
                    });
                }
            }], server: { host: '127.0.0.1', port: 0 }
    });
    await server.listen();
    const base = 'http://127.0.0.1:' + server.httpServer.address().port;
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.on('pageerror', e => report.errors.push({ code: 'PAGE_ERROR', phase: report.phase, hash: hash(String(e)) }));
    page.on('console', m => {
        if (m.type() === 'error')
            report.errors.push({
                code: 'CONSOLE_ERROR', phase: report.phase, hash: hash(m.text()), components: ['MaterialCatalogMetadataEditor', 'MaterialCatalogFilters', 'MaterialsWorkspace', 'ResourceTable', 'Button', 'Pagination', 'DisclosureCard'].filter(name => m.text().includes(name)), diagnostic: ([['REACT_RENDER_UPDATE', /Cannot update a component/], ['REACT_KEY', /unique.*key/], ['REACT_DOM_NESTING', /cannot (?:be a child|contain a nested)|validateDOMNesting/], ['REACT_UNKNOWN_PROP', /does not recognize|Unknown event handler property/], ['REACT_UNCONTROLLED', /uncontrolled|controlled.*input/], ['RESOURCE_LOAD', /Failed to load resource/], ['PASSIVE_EVENT', /passive event listener/], ['ARIA_LABEL', /aria-label|accessible name|aria-labelledby/]].find(([, pattern]) => pattern.test(m.text())) || ['UNKNOWN'])[0]
            });
    });
    await page.route('**/*', route => route.request().url().startsWith(base) || /^(?:data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
    const open = async (mode = 'workspace', width = 1366) => {
        await page.setViewportSize({ width, height: 768 });
        await page.goto(base + '/fixture?mode=' + mode, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.getByTestId(mode === 'editor' ? 'material-catalog-directory' : 'materials-count').waitFor();
        if (mode === 'editor')
            await page.waitForFunction(() => !document.querySelector('[data-testid="material-catalog-directory"]').disabled);
        else
            await page.waitForFunction(() => document.querySelectorAll('[data-testid^="material-resource_"]').length > 0);
    };
    const selectFirst = async () => {
        await page.locator('[data-testid^="material-resource_"] button').first().click();
        await page.waitForFunction(() => !document.querySelector('[data-testid="material-catalog-directory"]').disabled);
    };
    const noOverflow = async () => {
        const g = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, mainLeft:document.getElementById('fixture-main').getBoundingClientRect().left,mainWidth:document.getElementById('fixture-main').getBoundingClientRect().width }));
        assert(g.scroll <= g.width + 1);
        assert.equal(g.mainLeft,g.width>900?248:200);
        assert.equal(g.mainWidth,g.width-g.mainLeft);
        report.geometry.push(g);
    };
    await check('WORKSPACE_GLOBAL_FILTER_QUERY_PAGING_AND_CLEAR', async () => {
        await open();
        assert.match(await page.getByTestId('materials-count').innerText(), /151/);
        await page.getByTestId('materials-next').click();
        await page.waitForFunction(() => window.harness.calls.filter(c => c.name === 'list').at(-1).input.offset === 50);
        await page.getByTestId('materials-filter-directory').selectOption(JSON.stringify('目录B'));
        await page.waitForFunction(() => document.querySelector('[data-testid="materials-count"]').textContent.startsWith('51 份'));
        await page.getByTestId('materials-filter-tags').selectOption(['物理', '实验']);
        await page.getByTestId('materials-filter-format').selectOption('PDF');
        await page.getByTestId('materials-filter-state').selectOption('ready');
        await page.waitForFunction(() => {
            const q = window.harness.calls.filter(c => c.name === 'list').at(-1).input;
            return q.offset === 0 && q.scope.tags.length === 2 && q.scope.format === 'PDF' && q.scope.state === 'ready';
        });
        await page.getByTestId('materials-filter-clear').click();
        await page.waitForFunction(() => {
            const q = window.harness.calls.filter(c => c.name === 'list').at(-1).input;
            return q.offset === 0 && q.scope.directory === null && q.scope.tags.length === 0 && !q.scope.format && !q.scope.state && !q.query;
        });
    });
    await check('WORKSPACE_LATE_LIST_RESPONSE_DOES_NOT_RESTORE_OLD_FILTER', async () => {
        await page.evaluate(() => window.harness.holdList = true);
        await page.getByTestId('materials-filter-directory').selectOption(JSON.stringify('目录A'));
        await page.waitForFunction(() => window.harness.heldLists.length > 0);
        await page.evaluate(() => window.harness.holdList = false);
        await page.getByTestId('materials-filter-directory').selectOption(JSON.stringify('目录B'));
        await page.waitForFunction(() => document.querySelector('[data-testid="materials-count"]').textContent.startsWith('51 份'));
        await page.evaluate(() => window.harness.heldLists.splice(0).forEach(f => f()));
        await page.waitForTimeout(50);
        assert.match(await page.getByTestId('materials-count').innerText(), /^51 份/);
    });
    await check('WORKSPACE_DIRTY_GUARD_CANCEL_AND_KEYBOARD_SAVE', async () => {
        await page.getByTestId('materials-filter-clear').click();
        await selectFirst();
        await page.getByTestId('material-catalog-directory').fill('新目录');
        assert(await page.getByTestId('materials-filter-directory').isDisabled());
        assert(await page.getByTestId('materials-mode-text').isEnabled());
        await page.getByTestId('materials-mode-text').click();
        assert.equal(await page.getByTestId('materials-mode-catalog').getAttribute('aria-pressed'), 'true');
        await page.getByTestId('material-catalog-cancel').click();
        assert.equal(await page.getByTestId('material-catalog-directory').inputValue(), '目录A');
        assert(await page.getByTestId('materials-filter-directory').isEnabled());
        await page.getByTestId('material-catalog-tags').fill('物理, 实验, 新标签');
        await page.getByTestId('material-catalog-save').focus();
        await page.keyboard.press('Space');
        await page.waitForFunction(() => window.harness.saveCount === 1);
        await page.waitForFunction(() => !document.querySelector('[data-testid="materials-filter-directory"]').disabled);
        assert.equal(await page.evaluate(() => window.harness.calls.filter(c => c.name === 'save').length), 1);
    });
    await check('WORKSPACE_GLOBAL_NAVIGATION_DIRTY_AND_UNKNOWN_GUARD',async()=>{
        await open();await selectFirst();await page.getByTestId('material-catalog-directory').fill('导航草稿');
        assert.equal(await page.evaluate(()=>window.harness.navigate('settings')),false);
        await page.getByTestId('outside-probe').click();
        assert.equal(await page.evaluate(()=>window.harness.externalClicks||0),0);
        const prevented=await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});assert(prevented);
        await page.evaluate(()=>window.harness.lostReply=true);await page.getByTestId('material-catalog-save').click();await page.getByTestId('material-catalog-reconcile').waitFor();
        assert.equal(await page.evaluate(()=>window.harness.navigate('settings')),false);
        assert.equal(await page.getByTestId('left-fixture').count(),0);
        await page.getByTestId('material-catalog-reconcile').click();
        await page.waitForFunction(()=>!document.querySelector('[data-testid="materials-filter-directory"]').disabled);
        assert.equal(await page.evaluate(()=>window.harness.navigate('settings')),true);
        await page.getByTestId('left-fixture').waitFor();
    });
    await check('UNKNOWN_SAVE_BLOCKS_WRITES_AND_READ_ONLY_RECONCILES', async () => {
        await open('editor');
        await page.evaluate(() => window.harness.lostReply = true);
        await page.getByTestId('material-catalog-directory').fill('已提交但回包丢失');
        await page.getByTestId('material-catalog-save').click();
        await page.getByTestId('material-catalog-reconcile').waitFor();
        assert(await page.getByTestId('material-catalog-save').isDisabled());
        assert(await page.evaluate(() => window.harness.blocked));
        await page.getByTestId('material-catalog-reconcile').click();
        await page.waitForFunction(() => !window.harness.blocked);
        assert.equal(await page.evaluate(() => window.harness.saveCount), 1);
        assert.equal(await page.getByTestId('material-catalog-directory').inputValue(), '已提交但回包丢失');
    });
    await check('UNKNOWN_READ_FAILURE_NEVER_CLEARS_PENDING_OR_REWRITES', async () => {
        await open('editor');
        await page.evaluate(() => window.harness.lostReply = true);
        await page.getByTestId('material-catalog-tags').fill('pending');
        await page.getByTestId('material-catalog-save').click();
        await page.getByTestId('material-catalog-reconcile').waitFor();
        await page.evaluate(() => window.harness.readFail = true);
        await page.getByTestId('material-catalog-reconcile').click();
        await page.waitForFunction(() => document.querySelector('[data-testid="material-catalog-message"]').textContent.includes('结果仍待核实'));
        assert(await page.evaluate(() => window.harness.blocked));
        assert.equal(await page.evaluate(() => window.harness.saveCount), 1);
    });
    await check('LATE_METADATA_CANNOT_OVERWRITE_NEW_RESOURCE', async () => {
        await open('editor');
        await page.evaluate(() => {
            window.harness.holdRead = true;
            window.harness.refresh();
        });
        await page.waitForFunction(() => window.harness.heldReads.length > 0);
        await page.evaluate(() => {
            window.harness.holdRead = false;
            window.harness.select(101);
        });
        await page.waitForFunction(() => document.querySelector('[data-testid="material-catalog-directory"]').value === '目录B');
        await page.evaluate(() => window.harness.heldReads.splice(0).forEach(f => f()));
        await page.waitForTimeout(30);
        assert.equal(await page.getByTestId('material-catalog-directory').inputValue(), '目录B');
    });
    await check('BODY_RECEIVES_REAL_SCOPE_AND_DROPS_LATE_RESULT', async () => {
        await open();
        await page.getByTestId('materials-filter-directory').selectOption(JSON.stringify('目录A'));
        await page.getByTestId('materials-filter-tags').selectOption(['物理']);
        await page.getByTestId('materials-mode-text').click();
        await page.getByTestId('materials-text-query').fill('浮力');
        await page.evaluate(() => window.harness.holdBody = true);
        await page.getByTestId('materials-text-submit').click();
        await page.waitForFunction(() => window.harness.heldBody.length === 1);
        await page.getByTestId('materials-filter-directory').selectOption(JSON.stringify('目录B'));
        await page.evaluate(() => window.harness.holdBody = false);
        await page.getByTestId('materials-text-submit').click();
        await page.waitForFunction(() => document.querySelector('[data-testid="materials-text-results"]')?.textContent.includes('BODY-目录B'));
        await page.evaluate(() => window.harness.heldBody.splice(0).forEach(f => f()));
        await page.waitForTimeout(30);
        assert(!(await page.getByTestId('materials-text-results').innerText()).includes('BODY-目录A'));
        assert.match(await page.getByTestId('materials-semantic-coverage').innerText(), /题意分支未执行/);
        assert.match(await page.getByTestId('materials-text-actual-mode').innerText(), /关键词/);
        const q = await page.evaluate(() => window.harness.calls.filter(c => c.name === 'body').at(-1).input);
        assert.equal(q.scope.directory, '目录B');
        assert.deepEqual(q.scope.tags, ['物理']);
        await page.getByTestId('materials-filter-clear').click();
        assert.equal(await page.getByTestId('materials-text-query').inputValue(), '');
        assert.equal(await page.getByTestId('materials-text-results').count(), 0);
    });
    for (const width of [1366, 800])
        await check('OWN_LAYOUT_KEYBOARD_' + width, async () => {
            await open('workspace', width);
            await selectFirst();
            await page.getByTestId('material-catalog-directory').focus();
            await page.keyboard.press('Control+A');
            await page.keyboard.type('键盘目录');
            await page.getByTestId('material-catalog-cancel').focus();
            await page.keyboard.press('Space');
            assert.equal(await page.getByTestId('material-catalog-directory').inputValue(), '目录A');
            await noOverflow();
            await page.getByTestId('materials-filter-directory').focus();
            assert.equal(await page.locator(':focus').getAttribute('data-testid'), 'materials-filter-directory');
            await page.screenshot({ path: path.join(out, 'workspace-' + width + '.png') });
        await page.getByTestId('material-catalog-editor').screenshot({path:path.join(out,'editor-'+width+'.png')});
        });
    await check('NO_PAGE_OR_CONSOLE_ERRORS', async () => assert.deepEqual(report.errors, []));
    report.success = true;
}
catch (error) {
    report.failure = {
        code: 'UI_FOCUSED_FAILURE', phase: report.phase, hash: hash(String(error)), qaCode: error.name === 'TimeoutError' ? 'QA_TIMEOUT' : error.code === 'ERR_ASSERTION' ? 'QA_ASSERTION' : 'QA_UNKNOWN', site: String(error.stack).match(/material-catalog-ui-focused-test\.mjs:\d+:\d+/)?.[0]
    };
    process.exitCode = 1;
    if (page)
        await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {
        });
}
finally {
    await browser?.close();
    await server?.close();
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({
        code: report.success ? 'CATALOG_UI_PASS' : 'CATALOG_UI_FAIL', phase: report.phase, checks: report.checks, errors: report.errors, output: out
    }));
}
