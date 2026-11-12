import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server = await createServer({appType: 'custom', optimizeDeps: {noDiscovery: true}, server: {middlewareMode: true}});
try {
  const {PiPermissionApproval} = await server.ssrLoadModule('/src/renderer/components/office/PiPermissionApproval.tsx');
  const {PiCopyApproval} = await server.ssrLoadModule('/src/renderer/components/office/PiCopyApproval.tsx');
  const base = {schemaVersion: 2, id: 'confirm_00000000-0000-4000-8000-000000000001', revision: 7,
    requestDigest: 'a'.repeat(64), permissionSnapshotHash: 'b'.repeat(64), grantRefs: [], state: 'pending', scope: 'operation',
    createdAt: '2026-11-12T00:00:00.000Z', updatedAt: '2026-11-12T00:00:00.000Z', request: {
      schemaVersion: 2, owner: {sessionId: 'aisession_00000000-0000-4000-8000-000000000001', taskId: 'xitask_' + 'c'.repeat(64), runId: 'run_fixture', generation: 1},
      requirementsVersion: 1, callId: 'call_fixture', action: 'exec_command', inputDigest: 'd'.repeat(64), purpose: '处理已授合成资料',
      summary: "Set-Content existing.txt 'change'; Remove-Item delete.txt", provider: null, classification: 'redacted',
      files: [], expiresAt: '2026-11-13T00:00:00.000Z', scopes: [{kind: 'filesystem', root: 'C:\\owned', identity: 'e'.repeat(64), actions: ['read', 'write', 'delete']},
        {kind: 'process', backend: 'appcontainer', executable: 'C:\\Windows\\powershell.exe', executableHash: 'f'.repeat(64), workspace: 'C:\\owned'}]
    }};
  const script = renderToStaticMarkup(React.createElement(PiPermissionApproval, {approval: base}));
  assert(script.includes('运行受控脚本')); assert(script.includes('写入或覆盖')); assert(script.includes('删除'));
  assert(script.includes('Remove-Item')); assert(script.includes('data-revision="7"')); assert(script.includes('data-approval-id="' + base.id + '"'));
  assert(!script.includes('复制教学资料')); assert(!script.includes('已有同名文件不会被覆盖'));
  const mcp = {...base, request: {...base.request, action: 'mcp_call', classification: 'teacher_private', summary: 'lookup_lesson {"topic":"合成"}', scopes: [
    {kind: 'network', origin: 'http://127.0.0.1:45678', methods: ['POST'], purpose: 'mcp_call'},
    {kind: 'mcp', serverId: 'mcp_fixture', sourceHash: 'e'.repeat(64), schemaHash: 'f'.repeat(64), tools: ['lookup_lesson']},
    {kind: 'egress', origin: 'http://127.0.0.1:45678', classifications: ['teacher_private']}
  ]}};
  const external = renderToStaticMarkup(React.createElement(PiPermissionApproval, {approval: mcp}));
  assert(external.includes('POST')); assert(external.includes('127.0.0.1:45678')); assert(external.includes('教师私有资料'));
  assert(!external.includes('仅执行本次复制')); assert(!external.includes('已有同名文件不会被覆盖'));
  const old = renderToStaticMarkup(React.createElement(PiCopyApproval, {approval: {id: base.id, runId: 'run_fixture', callId: 'call_fixture',
    source: 'source.txt', target: 'target.txt', state: 'pending'}, onDecision: async () => {}}));
  assert(old.includes('复制教学资料')); assert(old.includes('已有同名文件不会被覆盖'));
  const routed = renderToStaticMarkup(React.createElement(PiCopyApproval, {approval: {id: base.id, runId: 'run_fixture', callId: 'call_fixture',
    source: 'request', target: 'scope', state: 'pending', permission: base}, onDecision: async () => {}}));
  assert(routed.includes('pi-permission-approval')); assert(!routed.includes('复制教学资料'));
  console.log(JSON.stringify({success: true, passed: 4, boundary: 'Actual SSR components, frozen id/revision props, legacy copy compatibility. Actual clicks are checked in the Electron permission UI suite.'}));
} finally {await server.close();}
