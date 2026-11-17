import {openBudgetLedger} from './phase8-budget-ledger.mjs';
import {startCountingProxy} from './phase8-counting-proxy.mjs';

const [mode, encoded] = process.argv.slice(2);
const options = JSON.parse(encoded);
const ledger = openBudgetLedger({databasePath: options.databasePath});

try {
  if (mode === 'reserve') {
    process.send({kind: 'ready'});
    await new Promise(resolve => process.once('message', resolve));
    let reserved = 0;
    for (let index = 0; index < options.count; index++) {
      try {
        ledger.reserve({task: 'parallel', version: 'B', round: 1});
        reserved++;
      } catch (error) {
        if (error.code !== 'budget_exhausted') throw error;
      }
    }
    process.send({kind: 'done', reserved});
    ledger.close();
    process.disconnect();
  } else if (mode === 'hold') {
    const reservation = ledger.reserve({task: 'crash', version: 'A', round: 1});
    if (options.dispatch) ledger.markDispatching(reservation.reservationId);
    process.send({kind: 'reserved', reservation});
    setInterval(() => {}, 1000);
  } else if (mode === 'proxy') {
    const proxy = await startCountingProxy({ledger, providerEndpoint: options.endpoint,
      fixtureHttp: true, requestTimeoutMs: 30000, context: {task: 'crash-http', version: 'B', round: 1}});
    process.send({kind: 'listening', url: proxy.url});
  } else {
    throw Error('unknown_worker_mode');
  }
} catch (error) {
  process.send?.({kind: 'error', code: error.code || 'worker_failed'});
  process.exitCode = 1;
  ledger.close();
  process.disconnect?.();
}
