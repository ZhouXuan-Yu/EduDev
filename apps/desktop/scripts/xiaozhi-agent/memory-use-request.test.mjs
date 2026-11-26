import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { projectTeacherPreferenceRequest } from '../../src/main/xiaozhi-agent/preference-request-context.ts';

test('a compacted or replayed turn with identical text cannot inherit the current request guidance', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'edudev-r3-projection-'));
  const manager = SessionManager.create(root, root);
  const raw = '继续编写讲义。';
  const guidance = '本轮展示详细步骤。';
  const user = timestamp => ({role: 'user', content: raw, timestamp});
  const first = manager.appendMessage(user(1000));
  manager.appendMessage(user(2000));
  manager.appendMessage({role:'assistant', content:[{type:'text',text:'已收到。'}],
    api:'openai-completions', provider:'fixture', model:'fixture', stopReason:'stop',
    timestamp:2001, usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,
      cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}});
  manager.appendCompaction('先前任务已结束', first, 1000);
  const file = manager.getSessionFile();
  const before = fs.readFileSync(file);
  const prior = SessionManager.open(file, root, root).buildSessionContext();
  assert.deepEqual(projectTeacherPreferenceRequest(prior, raw, guidance, 3000), prior);
  assert.deepEqual(fs.readFileSync(file), before);

  manager.appendMessage(user(3000));
  const saved = fs.readFileSync(file);
  const current = SessionManager.open(file, root, root).buildSessionContext();
  const projected = projectTeacherPreferenceRequest(current, raw, guidance, 3000);
  const guided = projected.messages.filter(message => JSON.stringify(message).includes(guidance));
  assert.deepEqual(guided.map(message => message.timestamp), [3000]);
  assert.deepEqual(fs.readFileSync(file), saved);
  const ambiguous = {...current, messages:[...current.messages, user(3000)]};
  assert.deepEqual(projectTeacherPreferenceRequest(ambiguous, raw, guidance, 3000), ambiguous);
});
