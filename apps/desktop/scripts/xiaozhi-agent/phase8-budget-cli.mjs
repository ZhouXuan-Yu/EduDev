import fs from 'node:fs';
import {openBudgetLedger, budgetError} from './phase8-budget-ledger.mjs';
import {startCountingProxy} from './phase8-counting-proxy.mjs';

const [action, first, second, third] = process.argv.slice(2);
let ledger;
try {
  if (action === 'serve') {
    const config = JSON.parse(fs.readFileSync(first, 'utf8'));
    const keys = ['databasePath', 'limit', 'initialUsed', 'goalId', 'providerEndpoint', 'context',
      'port', 'routePath', 'requestTimeoutMs', 'maximumRequestBytes', 'maximumConcurrent'];
    if (!config || typeof config !== 'object' || Array.isArray(config)
        || Object.keys(config).some(key => !keys.includes(key))) throw budgetError('proxy_invalid_configuration');
    const {databasePath, limit, initialUsed, goalId, ...proxyConfig} = config;
    ledger = openBudgetLedger({databasePath, ...(limit === undefined ? {} : {limit}),
      ...(initialUsed === undefined ? {} : {initialUsed}), ...(goalId === undefined ? {} : {goalId})});
    const proxy = await startCountingProxy({...proxyConfig, ledger});
    console.log(JSON.stringify({kind: 'phase8_proxy_ready', url: proxy.url, baseURL: proxy.baseURL, budget: ledger.summary()}));
    let closing = false;
    async function shutdown() {
      if (closing) return;
      closing = true;
      await proxy.close(); ledger.close();
    }
    process.once('SIGINT', () => {void shutdown();});
    process.once('SIGTERM', () => {void shutdown();});
  } else if (action === 'authorize-unlimited') {
    if (second !== '--user-authorized' || third !== undefined) throw budgetError('budget_explicit_authorization_required');
    if (!first || !fs.existsSync(first)) throw budgetError('budget_missing_database');
    ledger = openBudgetLedger({databasePath: first});
    ledger.authorizeUnlimited();
    console.log(JSON.stringify({budget: ledger.summary()}));
    ledger.close();
  } else if (action === 'status' || action === 'bind-run') {
    if (!fs.existsSync(first)) throw budgetError('budget_missing_database');
    ledger = openBudgetLedger({databasePath: first});
    if (action === 'bind-run') ledger.bindRun(second, third);
    console.log(JSON.stringify({budget: ledger.summary(), attempts: ledger.attempts()}));
    ledger.close();
  } else {
    throw budgetError('usage_serve_config_or_status_database_or_bind_run_or_authorize_unlimited_database');
  }
} catch (error) {
  ledger?.close();
  console.error(JSON.stringify({success: false, code: typeof error.code === 'string' ? error.code : 'phase8_configuration_error'}));
  process.exitCode = 1;
}
