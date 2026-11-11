import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';

const {createTerminalTool} = await import('../../src/main/xiaozhi-agent/tools/terminal.ts');
const {createToolExecutionBoundary} = await import('../../src/main/xiaozhi-agent/tools/execution-bound.ts');
const {SessionExecutionRegistry} = await import('../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts');
const {validTerminalOutput} = await import('../../src/shared/xiaozhi-terminal.ts');
const {applyXiaozhiEvent} = await import('../../src/shared/xiaozhi-projection.ts');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-terminal-'));
const report = {ok:false, root, checks:[], paidRequests:0};
let call = 0, admitted = 0;
const registry = new SessionExecutionRegistry();
const tool = createTerminalTool({workspace:root, secret:'synthetic-secret',
  sanitize:async text=>text.replaceAll('合成教师', '[teacher]'), beforeExecute:()=>{admitted++;}});
const boundary = createToolExecutionBoundary({sessionId:'terminal', workspaceKey:root, registry,
  epoch:()=> 'owned', current:()=>true, waiting:()=>false, onWaiting:()=>()=>{},
  beforeDelivery:async()=>{}, attempt:async()=>{}});
const execute = (cmd, options={}, signal, update) => boundary.execute(tool, 'terminal_' + (++call),
  {cmd, ...options}, signal, update, {cwd:path.dirname(root)});
const check = async (name, work) => {await work(); report.checks.push(name); console.log('PASS ' + name);};
const alive = pid => {try {process.kill(pid,0); return true;} catch {return false;}};
async function waitGone(pid) {
  for (let i=0;i<80;i++) {if (!alive(pid) && registry.activeCount('terminal')===0) return; await sleep(50);}
  throw Error('Process or actual execution registry still active');
}
const previousKey = process.env.DEEPSEEK_API_KEY;
process.env.DEEPSEEK_API_KEY = 'synthetic-env-must-not-inherit';
try {
  await check('Actual PowerShell writes and reads Unicode file, computes, sanitizes live and final output', async()=>{
    const updates=[];
    const result=await execute("[IO.File]::WriteAllText((Join-Path (Get-Location) 'lesson.txt'),'浮力37'); Write-Output (6*7); Write-Output 'synthetic-secret 合成教师'; Get-Content -Encoding UTF8 lesson.txt", {}, undefined, value=>updates.push(value));
    assert.equal(result.details.terminal.exitCode,0);
    assert.equal(fs.readFileSync(path.join(root,'lesson.txt'),'utf8'),'浮力37');
    assert.match(result.details.terminal.output,/42/);
    assert.match(result.details.terminal.output,/浮力37/);
    assert.match(result.details.terminal.output,/\[redacted\] \[teacher\]/);
    assert(!JSON.stringify(updates).includes('synthetic-secret'));
    assert(updates.every(value=>validTerminalOutput(value.details.terminal)));
    report.example = result.details.terminal;
  });
  await check('Shell starts in real session workspace and excludes inherited provider/private-session env', async()=>{
    const result=await execute("Write-Output (Get-Location).Path; Write-Output ('key=' + $env:DEEPSEEK_API_KEY); Write-Output ('session=' + $env:PI_SESSION_FILE)");
    assert(result.details.terminal.output.includes(root));
    assert(!JSON.stringify(result).includes('synthetic-env-must-not-inherit'));
    assert.match(result.details.terminal.output,/key=\r?\n/);
    assert.match(result.details.terminal.output,/session=\r?\n/);
  });
  await check('Nonzero exit preserves actual stderr/output and exit code with actionable failure', async()=>{
    const result=await execute("[Console]::Error.WriteLine('owned stderr'); exit 7");
    assert(result.isError); assert.equal(result.details.execution.code,'execution_failed');
    assert.equal(result.details.terminal.exitCode,7);
    assert.match(result.details.terminal.output,/owned stderr/);
  });
  await check('Large terminal output is bounded with explicit truncation and final tail', async()=>{
    const result=await execute("1..4000 | ForEach-Object { Write-Output ('line-' + $_ + '-xxxxxxxxxxxxxxxxxxxx') }");
    const terminal=result.details.terminal;
    assert(terminal.truncated);assert(terminal.output.length<=32768);assert.match(terminal.output,/line-4000-/);
  });
  await check('Working directory rejects escaping scope before spawning and supports existing subdirectories', async()=>{
    assert.equal((await execute('Write-Output bad',{workdir:'..'})).details.execution.code,'permission_denied');
    fs.mkdirSync(path.join(root,'child'));
    const result=await execute('Write-Output (Get-Location).Path',{workdir:'child'});
    assert.equal(result.details.terminal.cwd,path.join(root,'child'));
  });
  await check('Command timeout terminates actual process with timeout receipt and releases execution', async()=>{
    const result=await execute('Start-Sleep -Seconds 5',{timeout:1});
    assert.equal(result.details.execution.code,'timeout');
    assert.equal(result.details.terminal.state,'timed_out');
    for(let i=0;i<80&&registry.activeCount('terminal');i++)await sleep(50);
    assert.equal(registry.activeCount('terminal'),0);
  });
  await check('Cancellation kills actual shell child, drains registry and prevents delayed file write', async()=>{
    const abort=new AbortController();let pid;
    const script="console.log('CHILD='+process.pid);setTimeout(()=>require('fs').writeFileSync('late.txt','unexpected'),4000);setInterval(()=>{},1000)";
    const result=await execute(`& node -e '${script.replaceAll("'", "''")}'`,{},abort.signal, value=>{
      const match=value.details.terminal.output.match(/CHILD=(\d+)/);
      if(match&&!pid){pid=Number(match[1]);abort.abort();}
    });
    assert(pid);assert.equal(result.details.execution.code,'cancelled');await waitGone(pid);
    await sleep(4100);assert(!fs.existsSync(path.join(root,'late.txt')));
  });
  await check('Versioned terminal events preserve final/stop state and reject foreign or malformed output', async()=>{
    const turn={id:'owned',status:'running',items:[{id:'call',kind:'tool',toolName:'exec_command',status:'inProgress'}]};
    const event={kind:'tool_output',callId:'call',terminal:{...report.example,state:'running'},runId:'owned',sessionId:'terminal',sequence:1};
    const next=applyXiaozhiEvent(turn,event);assert.deepEqual(next.items[0].terminal,event.terminal);
    assert.equal(applyXiaozhiEvent(turn,{...event,runId:'foreign'}).items[0].terminal,undefined);
    assert(!validTerminalOutput({...event.terminal,output:'x'.repeat(32769)}));
    const ended=applyXiaozhiEvent(next,{kind:'tool_end',callId:'call',tool:'exec_command',success:false,terminalState:'cancelled',runId:'owned',sessionId:'terminal',sequence:2});
    assert.equal(ended.items[0].terminal.state,'cancelled');
    const stopped=applyXiaozhiEvent(next,{kind:'status',status:'interrupted',runId:'owned',sessionId:'terminal',sequence:2});
    assert.equal(stopped.items[0].terminal.state,'cancelled');
    assert.equal(stopped.items[0].terminal.output,report.example.output);
  });
  report.ok=true;report.admitted=admitted;
} catch(error) {report.error=String(error.stack);process.exitCode=1;}
finally {
  if(previousKey===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previousKey;
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:report.ok,root,checks:report.checks.length,error:report.error}));
}
