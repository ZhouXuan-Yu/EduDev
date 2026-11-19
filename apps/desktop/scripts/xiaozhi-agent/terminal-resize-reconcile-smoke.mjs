import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { retiredResizeProof } from '../../src/main/xiaozhi-agent/effects/terminal-resize-proof.ts';
import { createEffectReconciler } from '../../src/main/xiaozhi-agent/effects/reconcile.ts';
import { createExecutionEffectReader } from '../../src/main/xiaozhi-agent/effects/readback.ts';
// Usage: node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs
// scripts/xiaozhi-agent/terminal-resize-reconcile-smoke.mjs <synthetic-fixture-directory> <expected-database-sha256>
// The source is read-only. Deliberately invalid states below exist only in owned TEMP copies.
const [fixtureDirectory, expectedHash] = process.argv.slice(2);
assert(fixtureDirectory && /^[a-f0-9]{64}$/u.test(expectedHash || ''), 'Pass the explicit synthetic fixture directory and frozen lowercase database SHA256');
const sealed = fs.realpathSync(path.resolve(fixtureDirectory));
const tempRoot = fs.realpathSync(os.tmpdir());
const relative = path.relative(tempRoot, sealed);
assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Fixture must resolve inside owned TEMP');
assert(/^phase7-w3-late-ui-[a-z0-9]+$/u.test(path.basename(sealed)), 'Only the named synthetic W3 fixture is supported');
const fixture = JSON.parse(fs.readFileSync(path.join(sealed, 'report.json'), 'utf8'));
assert.equal(path.resolve(fixture.dir).toLowerCase(), sealed.toLowerCase());
assert(/synthetic/iu.test(fixture.scope) && /^xitask_[a-f0-9]{64}$/u.test(fixture.oldTask?.id));
assert.equal(fixture.oldTask.sessionId, fixture.lateJob?.sessionId);
assert.equal(fixture.oldTask.id, fixture.lateJob?.taskId);
const original = fs.realpathSync(path.join(sealed, 'data/app.db'));
const databaseRelative = path.relative(sealed, original);
assert(databaseRelative && !databaseRelative.startsWith('..') && !path.isAbsolute(databaseRelative));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const before = sha(original);
assert.equal(before, expectedHash, 'The sealed synthetic database changed; do not run against an unverified fixture');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-resize-reconcile-')), checks = [], report = {
    success: false, output, sealed, before, checks, paidCalls: 0,
    scope: 'Frozen synthetic SQLite and original canonical file readback. Invalid states are changed only in owned TEMP copies; actual Host/Electron confirmation is separate.'
};
let counter = 0;
async function check(name, action) {
    const file = path.join(output, 'copy-' + counter++ + '.db');
    fs.copyFileSync(original, file);
    const db = new DatabaseSync(file);
    const sql = {
        all: async (q, v = []) => db.prepare(q).all(...v), run: async (q, v = []) => {
            db.prepare(q).run(...v);
        }, change: async (q, v = []) => Number(db.prepare(q).run(...v).changes)
    };
    sql.transaction = async (action) => {
        db.exec('BEGIN IMMEDIATE');
        try {
            const value = await action(sql);
            db.exec('COMMIT');
            return value;
        }
        catch (error) {
            db.exec('ROLLBACK');
            throw error;
        }
    };
    const row = db.prepare("SELECT * FROM xiaozhi_effects_v1 WHERE state='unknown' AND json_extract(document_json,'$.operation')='job_resize'").get();
    assert(row);
    const effect = JSON.parse(row.document_json), jobRow = db.prepare('SELECT * FROM xiaozhi_jobs_v1 WHERE job_id=?').get(effect.target), job = JSON.parse(jobRow.document_json);
    const readback = {
        readEffect: createExecutionEffectReader(sql)
    };
    const mutateJob = change => {
        const value = structuredClone(job);
        change(value);
        db.prepare('UPDATE xiaozhi_jobs_v1 SET document_json=?,state=?,lease_revision=?,controller_revision=?,revision=? WHERE job_id=?').run(JSON.stringify(value), value.state, value.leaseRevision, value.controllerRevision, value.revision, value.jobId);
    };
    const mutateEffect = (id, change) => {
        const value = JSON.parse(db.prepare('SELECT document_json FROM xiaozhi_effects_v1 WHERE effect_id=?').get(id).document_json);
        change(value);
        db.prepare('UPDATE xiaozhi_effects_v1 SET document_json=?,state=?,revision=? WHERE effect_id=?').run(JSON.stringify(value), value.state, value.revision, id);
        return value;
    };
    const mutateAudit = change => {
        const row = db.prepare("SELECT * FROM xiaozhi_permission_audit_v1 WHERE reference=? AND kind='terminal_job_terminal'").get(job.jobId), value = JSON.parse(row.metadata_json);
        change(value);
        db.prepare('UPDATE xiaozhi_permission_audit_v1 SET metadata_json=? WHERE id=?').run(JSON.stringify(value), row.id);
    };
    const read = record => retiredResizeProof(sql, readback, record || effect);
    try {
        await action({
            db, sql, effect, job, jobRow, readback, read, mutateJob, mutateEffect, mutateAudit
        });
        checks.push({
            name, pass: true
        });
        console.log('PASS ' + name);
    }
    finally {
        db.close();
    }
}
try {
    await check('Original sealed closed Job supplies retirement proof; original reconciler changes only resize and preserves non-ACK meaning', async (x) => {
        const proof = await x.read();
        assert(proof);
        assert.match(proof.proofs[0].reference, /terminal-resize-retired-closed-job\.v1:/);
        const old = x.db.prepare('SELECT effect_id,document_json FROM xiaozhi_effects_v1 ORDER BY effect_id').all();
        await createEffectReconciler({
            sql: x.sql, readback: x.readback, networkDirectory: path.join(output, 'network')
        }).recheck(x.effect.owner.sessionId, x.effect.owner.taskId);
        const after = x.db.prepare('SELECT effect_id,document_json FROM xiaozhi_effects_v1 ORDER BY effect_id').all();
        for (const prior of old) {
            const current = after.find(row => row.effect_id === prior.effect_id);
            if (prior.effect_id !== x.effect.id)
                assert.equal(current.document_json, prior.document_json);
            else {
                const settled = JSON.parse(current.document_json);
                assert.equal(settled.state, 'reconciled');
                assert.equal(settled.outcome.acknowledgedInputSequence, undefined);
                assert.deepEqual(settled.outcome.references, proof.proofs.map(value => value.reference));
                assert.equal(settled.revision, x.effect.revision + 1);
            }
        }
    });
    await check('Live or incompletely committed Job cannot retire a resize', async (x) => {
        for (const change of [
            j => j.state = 'running', j => j.cleanup = 'needs_check', j => j.projectionState = 'pending', j => j.exitCode = 1, j => j.inputClosed = false
        ]) {
            x.mutateJob(change);
            assert.equal(await x.read(), null);
            x.mutateJob(() => {
            });
        }
    });
    await check('Unacknowledged real-input shape remains unknown and blocks resize reconciliation', async (x) => {
        x.db.prepare('UPDATE xiaozhi_jobs_v1 SET acknowledged_input_sequence=input_sequence-1 WHERE job_id=?').run(x.job.jobId);
        const input = x.db.prepare("SELECT effect_id FROM xiaozhi_effects_v1 WHERE json_extract(document_json,'$.execution.jobId')=? AND json_extract(document_json,'$.operation')='job_input' AND json_extract(document_json,'$.execution.inputSequence')=2").get(x.job.jobId);
        x.mutateEffect(input.effect_id, value => {
            value.state = 'unknown';
            value.outcome = null;
            value.proofs = [];
        });
        assert.equal(await x.read(), null);
        await createEffectReconciler({
            sql: x.sql, readback: x.readback, networkDirectory: path.join(output, 'network')
        }).recheck(x.effect.owner.sessionId, x.effect.owner.taskId);
        for (const id of [
            input.effect_id, x.effect.id
        ])
            assert.equal(x.db.prepare('SELECT state FROM xiaozhi_effects_v1 WHERE effect_id=?').get(id).state, 'unknown');
    });
    await check('Input, EOF, close and other operation types never use the resize proof', async (x) => {
        for (const operation of [
            'job_input', 'job_eof', 'job_close', 'job_input_close', 'tool', 'network_post'
        ])
            assert.equal(await x.read({
                ...x.effect, operation
            }), null);
        for (const state of [
            'intent', 'executing', 'failed', 'committed'
        ])
            assert.equal(await x.read({
                ...x.effect, state
            }), null);
    });
    await check('Foreign session Task, changed target and lease identities cannot consume closure', async (x) => {
        for (const patch of [
            {
                owner: {
                    ...x.effect.owner, sessionId: 'other'
                }
            }, {
                owner: {
                    ...x.effect.owner, taskId: 'other'
                }
            }, {
                target: 'term_other'
            }, {
                targetVersion: '2'
            }, {
                execution: {
                    ...x.effect.execution, leaseId: 'other'
                }
            }, {
                execution: {
                    ...x.effect.execution, inputSequence: 1
                }
            }
        ])
            assert.equal(await x.read({
                ...x.effect, ...patch
            }), null);
    });
    await check('Incomplete cleanup or wrong native owner, runtime, helper and execution facts refuse proof', async (x) => {
        for (const change of [
            a => a.owner.runId = 'wrong', a => a.executionId = 'wrong', a => a.helperHash = 'wrong', a => a.runtimeVersion = 'wrong', a => a.result.executionId = 'wrong', a => a.result.exitCode = 1, a => a.result.cleanup.ptyClosed = false, a => a.result.cleanup.profileRemoved = false, a => a.result.cleanup.remainingOwnedAces = 1, a => a.result.cleanup.jobActiveProcesses = 1
        ]) {
            const original = x.db.prepare("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE reference=? AND kind='terminal_job_terminal'").get(x.job.jobId).metadata_json;
            x.mutateAudit(change);
            assert.equal(await x.read(), null);
            x.db.prepare("UPDATE xiaozhi_permission_audit_v1 SET metadata_json=? WHERE reference=? AND kind='terminal_job_terminal'").run(original, x.job.jobId);
        }
    });
    await check('Absent or uncertain parent execution and mismatched receipt contract stay unresolved', async (x) => {
        const parent = x.db.prepare('SELECT * FROM xiaozhi_effects_v1 WHERE effect_id=?').get(x.job.effectId);
        x.mutateEffect(parent.effect_id, value => value.state = 'unknown');
        assert.equal(await x.read(), null);
        x.db.prepare('UPDATE xiaozhi_effects_v1 SET state=?,document_json=? WHERE effect_id=?').run(parent.state, parent.document_json, parent.effect_id);
        x.db.prepare("UPDATE xiaozhi_tool_receipts SET phase='admitted' WHERE run_id=? AND call_id=?").run(x.effect.receipt.runId, x.effect.receipt.callId);
        assert.equal(await x.read(), null);
        x.db.prepare("UPDATE xiaozhi_tool_receipts SET phase='settled',contract_json=? WHERE run_id=? AND call_id=?").run(JSON.stringify({
            ...x.effect.contract, sourceHash: '0'.repeat(64)
        }), x.effect.receipt.runId, x.effect.receipt.callId);
        assert.equal(await x.read(), null);
    });
    await check('Canonical file readback remains a separate necessary condition', async (x) => {
        assert.equal(await retiredResizeProof(x.sql, {
            readEffect: async () => 'uncertain'
        }, x.effect), null);
    });
    await check('Later controller Run binds its own receipt while native audit must still bind the original Job', async (x) => {
        const next = x.db.prepare('SELECT run_id,generation FROM xiaozhi_event_runs WHERE session_id=? AND run_id!=? ORDER BY rowid DESC LIMIT 1').get(x.job.sessionId, x.job.origin.runId);
        assert(next);
        const call = 'typed_later_controller';
        x.db.prepare('INSERT INTO xiaozhi_tool_receipts SELECT ?,?,generation,tool,start_sequence,phase,admitted,result_digest,success,native_entry_id,native_digest,native_state,effect_state,updated_at,contract_json FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?').run(next.run_id, call, x.effect.receipt.runId, x.effect.receipt.callId);
        x.db.prepare('UPDATE xiaozhi_tool_receipts SET generation=? WHERE run_id=? AND call_id=?').run(next.generation, next.run_id, call);
        const effect = {
            ...x.effect, tool: 'exec_command', owner: {
                ...x.effect.owner, runId: next.run_id, generation: next.generation
            }, callId: call, receipt: {
                runId: next.run_id, callId: call
            }
        };
        assert(await x.read(effect));
        x.mutateAudit(a => a.owner = effect.owner);
        assert.equal(await x.read(effect), null);
    });
    await check('Concurrent Effect revision change rejects the stale reconciliation instead of overwriting it', async (x) => {
        let changed = false;
        const readEffect = async (...args) => {
            const result = await x.readback.readEffect(...args);
            if (!changed) {
                changed = true;
                x.mutateEffect(x.effect.id, value => value.revision++);
            }
            return result;
        };
        await assert.rejects(createEffectReconciler({
            sql: x.sql, readback: {
                readEffect
            }, networkDirectory: path.join(output, 'network')
        }).recheck(x.effect.owner.sessionId, x.effect.owner.taskId), /effect_revision_conflict/);
        assert.equal(x.db.prepare('SELECT state FROM xiaozhi_effects_v1 WHERE effect_id=?').get(x.effect.id).state, 'unknown');
    });
    report.success = true;
}
catch (error) {
    report.error = String(error.stack);
    process.exitCode = 1;
}
finally {
    report.after = sha(original);
    assert.equal(report.after, before);
    fs.writeFileSync(path.join(output, 'REPORT.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
}
