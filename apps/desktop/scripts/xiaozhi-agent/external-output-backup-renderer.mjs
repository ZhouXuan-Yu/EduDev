import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
const root=fs.mkdtempSync('test-results/xiaozhi-agent/external-backup-renderer-'),checks=[];
try{
 const {DataBackupState}=await server.ssrLoadModule('/src/renderer/components/DataBackupPanel.tsx');
 const base={exportPath:'D:\\Backup',manifestPath:'D:\\Backup\\manifest.json',verified:true,fileCount:9};
 const externalOutputs={schemaVersion:1,backupPrefix:'__xiaozhi_external_outputs__',roots:[],fileCount:7,omittedCount:4,omitted:['missing-one','missing-two','unknown-root','fourth-detail']};
 const render=state=>renderToStaticMarkup(React.createElement(DataBackupState,{state})).replace(/<!--.*?-->/g,'');
 const exported=render({status:'export_success',message:'备份文件校验通过，仍有遗漏',exportResult:{...base,externalOutputs}});
 assert(exported.includes('7 个另选目录成果；4 项未纳入'));assert(exported.includes('missing-one；missing-two；unknown-root'));assert(exported.includes('其余遗漏见备份清单'));assert(!exported.includes('fourth-detail'));checks.push('Export makes omissions visible with bounded details and a complete-manifest pointer');
 const verified=render({status:'verify_success',message:'清单内文件校验通过',verificationResult:{...base,backupPath:base.exportPath,externalOutputs,missingFiles:[],changedFiles:[],unexpectedFiles:[]}});
 assert(verified.includes('4 项未纳入'));assert(verified.includes('请找回对应文件或目录后重新备份'));checks.push('Read-only verification retains the original coverage omissions');
 assert(!render({status:'export_success',message:'旧备份',exportResult:base}).includes('data-backup-external-summary'));checks.push('Old manifests do not acquire an invented external-file coverage summary');
 fs.writeFileSync(root+'/report.json',JSON.stringify({ok:true,checks,scope:'Omission visibility only; formal settings interaction is in external-output-backup-ui.mjs.'},null,2));
 console.log(JSON.stringify({ok:true,checks:checks.length,root}));
}finally{await server.close();}
