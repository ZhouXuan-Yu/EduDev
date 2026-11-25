import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {test} from 'node:test';
import path from 'node:path';
import {build} from 'esbuild';

// Exercise the real desktop sampler and coordinator. Replace only the Electron
// event source, OS sensors and clock to make the input sequence reproducible.
const directory=path.resolve(import.meta.dirname,'../..');
const {outputFiles:[source]}=await build({
  absWorkingDir:directory,entryPoints:['src/main/host-resources/desktop.ts'],bundle:true,
  write:false,platform:'node',format:'esm',
  plugins:[{name:'pressure-fixture',setup(builder){
    builder.onResolve({filter:/^(electron|node:os)$/},args=>({path:args.path,namespace:'pressure-fixture'}));
    builder.onLoad({filter:/.*/,namespace:'pressure-fixture'},args=>({contents:args.path==='electron'
      ? 'export const app=globalThis.pressureFixture.app, powerMonitor=globalThis.pressureFixture.power;'
      : 'const os=globalThis.pressureFixture.os; export const {cpus,freemem,totalmem,availableParallelism}=os;'}));
  }}],
});

let generation=0;
async function fixture(ready=true){
  let clock=100, total=10000, idle=9000, tick, intervals=0;
  const MiB=1048576, overrides={memory:6000,cpu:.1,err:false};
  const app=new EventEmitter(),power=new EventEmitter();
  app.isReady=()=>ready;
  app.getAppMetrics=()=>[{memory:{workingSetSize:12000}}];
  globalThis.pressureFixture={app,power,os:{
    totalmem:()=>32*1024*MiB,availableParallelism:()=>16,
    freemem:()=>{if(overrides.err)throw Error('sensor failed');return overrides.memory*MiB;},
    cpus:()=>[{times:{idle,user:total-idle,nice:0,sys:0,irq:0}}],
  }};
  const interval=globalThis.setInterval, now=Object.getOwnPropertyDescriptor(performance,'now');
  globalThis.setInterval=(callback,period)=>{
    assert.equal(period,1000);
    intervals++;
    tick=callback;
    return {unref(){}};
  };
  Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
  const restore=()=>{
    globalThis.setInterval=interval;
    if(now)Object.defineProperty(performance,'now',now);
    else delete performance.now;
    delete globalThis.pressureFixture;
  };
  try{
    const host=await import('data:text/javascript;base64,'+Buffer.from(source.text+'\n// '+ ++generation).toString('base64'));
    return {host,overrides,power,restore,intervals:()=>intervals,ready:()=>{ready=true;app.emit('ready');},
      advance(ms=1000){clock+=ms;total+=1000;idle+=Math.round(1000*(1-overrides.cpu));tick();}};
  }catch(error){restore();throw error;}
}

async function start(host){
  const lease=await host.reserveHostStage('test','pressure','foreground',{cpu:1},60000);
  lease.settle();
}

test('starting the sampler before Electron is ready still handles resume and discards the prior CPU window',async()=>{
  const f=await fixture(false);
  try{
    await start(f.host);
    for(let i=0;i<10;i++)f.advance();
    assert.equal(f.host.hostResourceDiagnostics().pressure,0);
    assert.equal(f.intervals(),1);
    f.ready();
    assert.equal(f.power.listenerCount('resume'),1,'pre-ready reservations must not miss the native resume listener');
    f.power.emit('resume');
    const resumed=f.host.hostResourceDiagnostics();
    assert.equal(resumed.pressure,2);
    assert.equal(resumed.lastSample.cpuRatio,null);
    assert.equal(resumed.lastSample.reason,'resume');
    await start(f.host);
    assert.equal(f.intervals(),1);
  }finally{f.restore();}
});

test('sensor exceptions degrade future admissions without erasing existing work',async()=>{
  const f=await fixture();
  let running;
  try{
    await start(f.host);
    for(let i=0;i<10;i++)f.advance();
    running=await f.host.reserveHostStage('test','existing','foreground',{cpu:8,memoryMiB:3000},60000);
    assert(running.start());
    const wait=new AbortController();
    try{
      f.overrides.err=true;
      assert.doesNotThrow(()=>f.advance(),'OS reading errors must not escape the sampler');
      const degraded=f.host.hostResourceDiagnostics();
      assert.deepEqual([degraded.pressure,degraded.lastSample.reason,degraded.used.cpu,degraded.target.cpu,degraded.debt.cpu],[2,'sensor_failed',8,4,4]);
      const candidate=f.host.reserveHostStage('test','next','foreground',{cpu:5},60000,wait.signal);
      assert.equal(f.host.hostResourceDiagnostics().queued,1);
      running.settle();
      assert.equal(f.host.hostResourceDiagnostics().queued,1);
      f.overrides.err=false;
      for(let i=0;i<5;i++)f.advance();
      assert.equal(f.host.hostResourceDiagnostics().pressure,2);
      f.advance();
      assert.equal(f.host.hostResourceDiagnostics().pressure,1);
      (await candidate).settle();
    }finally{wait.abort();}
  }finally{running?.settle();f.restore();}
});

test('oscillation does not toggle capacity and missing, invalid or stale samples are explained',async()=>{
  const f=await fixture();
  try{
    await start(f.host);
    for(let i=0;i<10;i++)f.advance();
    for(const memory of [2047,2048,2047,2048,2047,2048]){
      f.overrides.memory=memory;f.advance();
      assert.equal(f.host.hostResourceDiagnostics().pressure,0);
    }
    f.overrides.memory=2047;
    f.advance();f.advance();
    assert.equal(f.host.hostResourceDiagnostics().pressure,1);
    for(const invalid of [NaN,-1,0]){
      f.overrides.memory=invalid;f.advance();
      const status=f.host.hostResourceDiagnostics();
      assert.equal(status.pressure,2);
      assert.equal(status.lastSample.reason,'invalid_memory');
      assert.equal(status.lastSample.availableMiB,null);
    }
    f.overrides.memory=6000;
    f.advance(5000);
    assert.equal(f.host.hostResourceDiagnostics().lastSample.reason,'stale_interval');
    for(let i=0;i<10;i++)f.advance();
    const recovered=f.host.hostResourceDiagnostics();
    assert.equal(recovered.pressure,0);
    assert(recovered.pressureSamples.some(sample=>sample.reason==='recovery_step'&&sample.level===1));
    assert(recovered.pressureSamples.length<=32);
  }finally{f.restore();}
});
