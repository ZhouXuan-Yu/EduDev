import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';

const output = process.argv[2];
const checkpoint = JSON.parse(fs.readFileSync(path.join(output, 'crash-checkpoint.json'), 'utf8'));
const store = new OmniEduStore(checkpoint.dataRoot);
let host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
const report: {success: boolean; error?: string; root: string; checks: unknown[]} = {success: false, root: checkpoint.root, checks: []};
try {
  await store.init();
  host = createXiaozhiProductionHost({store, dataRoot: checkpoint.dataRoot, enabled: false, emit: () => {}});
  for (const saved of checkpoint.persisted) {
    const approval = await store.xiaozhiState.permissions.approval(saved.sessionId, saved.id);
    assert.equal(approval?.state, saved.state); assert.equal(approval?.requestDigest, saved.digest);
    assert.equal(approval?.request.owner.taskId, saved.taskId);
    assert((await host.permissions.view(saved.sessionId)).approvals.some(item => item.id === saved.id && item.state === saved.state));
  }
  const rows = await store.xiaozhiState.sql.all("SELECT count(*) AS n FROM xiaozhi_permission_audit_v1 WHERE kind='sandbox_execution_finished'");
  assert.equal(rows[0].n, checkpoint.before);
  report.checks.push({name: 'Actual owned main SIGKILL cold init preserves v2 pending/approved Task facts without shell replay', pass: true});
  report.success = true;
} catch (error) {report.error = error instanceof Error ? error.stack : String(error); process.exitCode = 1;}
finally {
  await host?.close().catch(() => {}); await store.close().catch(() => {});
  fs.writeFileSync(path.join(output, 'restart-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
