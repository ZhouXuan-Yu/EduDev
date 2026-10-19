import { execFileSync } from 'node:child_process';

const ORCA = 'C:/Users/ZhouXuan/AppData/Local/Programs/orca/resources/bin/orca.exe';
const RUN = 'run_a4dbfcb56a64';
const MEANINGFUL = new Set(['worker_done', 'escalation', 'question']);
const DEADLINE = Date.now() + 60 * 60 * 1000;

function call(args) {
  const out = execFileSync(ORCA, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    timeout: 11 * 60 * 1000,
  });
  return JSON.parse(out);
}

function hasMeaningful(messages) {
  return (messages || []).some((message) => MEANINGFUL.has(message.type));
}

function main() {
  while (Date.now() < DEADLINE) {
    let res;
    try {
      res = call(['orchestration', 'check', '--run', RUN, '--json']);
    } catch (error) {
      // transient CLI/connection error: retry after a short pause
      continue;
    }

    const result = res.result || {};
    const messages = result.messages || [];

    if (messages.length) {
      if (hasMeaningful(messages)) {
        console.log(JSON.stringify(res, null, 2));
        process.exit(0);
      }
      if (result.deliveryId) {
        try {
          call(['orchestration', 'check', '--ack', result.deliveryId, '--json']);
        } catch {
          // ack failure will replay; retry on next loop
        }
      }
      continue;
    }

    try {
      const waited = call([
        'orchestration', 'check',
        '--run', RUN,
        '--wait',
        '--types', 'worker_done,escalation,question',
        '--timeout-ms', '600000',
        '--json',
      ]);
      const waitedResult = waited.result || {};
      if (hasMeaningful(waitedResult.messages)) {
        console.log(JSON.stringify(waited, null, 2));
        process.exit(0);
      }
    } catch {
      // wait timeout or transient error: loop and re-check
    }
  }

  console.error('check-loop deadline exceeded');
  process.exit(2);
}

main();
