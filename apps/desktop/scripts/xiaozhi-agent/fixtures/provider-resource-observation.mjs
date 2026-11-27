import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export async function observeProviderResources(app, main) {
  const mainDir = path.dirname(main);
  const ownerFile = fs.readdirSync(mainDir).filter(name => name.endsWith('.js')).map(name => path.join(mainDir, name))
    .find(file => fs.readFileSync(file, 'utf8').includes('function reserveHostStage('));
  assert(ownerFile, 'Use the actual Host Resource Scheduling R1 build');
  const reserveExport = fs.readFileSync(ownerFile, 'utf8').match(/\breserveHostStage as (\w+)/u)?.[1];
  assert(reserveExport, 'The compiled production lease entry must be available');
  await app.evaluate(async (_electron, {ownerFile, reserveExport}) => {
    const {Session} = process.getBuiltinModule('node:inspector');
    const req = process.getBuiltinModule('node:module').createRequire(ownerFile);
    const session = new Session();
    session.connect();
    const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params,
      (error, result) => error ? reject(error) : resolve(result)));
    const group = 'provider-lease-observation';
    const properties = objectId => post('Runtime.getProperties', {objectId, ownProperties:true});
    try {
      globalThis.providerLeaseEntry = req(ownerFile)[reserveExport];
      const entry = await post('Runtime.evaluate', {expression:'globalThis.providerLeaseEntry', objectGroup:group});
      const scopes = (await properties(entry.result.objectId)).internalProperties
        .find(property => property.name === '[[Scopes]]')?.value.objectId;
      if (!scopes) throw Error('Missing production module scope');
      const entries = (await properties(scopes)).result;
      let scheduler;
      for (const scope of entries.filter(item => item.value?.description === 'Module' || item.value?.description === 'Closure')) {
        scheduler = (await properties(scope.value.objectId)).result.find(property => property.name === 'coordinator')?.value.objectId;
        if (scheduler) break;
      }
      if (!scheduler) throw Error('Missing the real host lease coordinator');
      globalThis.readProviderLeases = async () => {
        const snapshot = await post('Runtime.callFunctionOn', {objectId:scheduler, returnByValue:true,
          functionDeclaration:'function() { return {...this.snapshot(), events:this.recentEvents()}; }'});
        if (snapshot.exceptionDetails) throw Error('Failed to read the real lease coordinator');
        return snapshot.result.value;
      };
      globalThis.closeProviderLeaseObservation = () => session.disconnect();
    } catch (error) { session.disconnect(); throw error; }
    finally { delete globalThis.providerLeaseEntry; }
  }, {ownerFile, reserveExport});
  return {
    read: () => app.evaluate(() => globalThis.readProviderLeases()),
    close: () => app.evaluate(() => globalThis.closeProviderLeaseObservation()),
  };
}
