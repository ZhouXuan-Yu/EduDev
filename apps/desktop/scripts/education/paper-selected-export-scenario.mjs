import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export async function exportSelectedPaper({page,app,open,edited,sessionId,snapshot,query,until,check,destination,output}) {
  const files=[];
  for(const audience of ['teacher','student']){
    await open();
    const dialog=page.getByTestId('pi-paper-dialog');
    assert.equal(await dialog.getAttribute('data-paper-id'),edited);
    assert.match(await dialog.getByTestId('paper-export-selected-version').innerText(),/等式课堂练习卷.*7 分/);
    if(audience==='teacher'){
      await dialog.getByTestId('paper-output-choose').click();
      await until(async()=>(await dialog.getByTestId('paper-output-label').innerText()).includes(path.basename(destination)));
      for(const [width,height] of [[1366,768],[1920,1080]]){
        await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
        await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
        const button=dialog.getByTestId('paper-export-teacher-docx');
        await button.click({trial:true});
        await page.screenshot({path:path.join(output,`selected-export-${width}x${height}.png`),animations:'disabled'});
      }
    }
    await dialog.getByTestId(`paper-export-${audience}-docx`).click();
    await dialog.waitFor({state:'hidden'});
    const prompt=page.getByTestId('office-prompt-input');
    const name=await until(async()=>{
      const text=await prompt.inputValue();return text.includes('education_export_paper')&&text.match(/“([^”]+\.docx)”/)?.[1];
    });
    const file=path.join(destination,name);
    await prompt.press('Enter');
    const draft=await until(async()=>(await snapshot()).officeArtifacts?.find(row=>row.path===name&&row.state==='pending'));
    const [savedDraft]=query('SELECT draft_json FROM xiaozhi_pi_office_drafts WHERE id=?',[draft.id]);
    const source=JSON.parse(savedDraft.draft_json).paperSource;
    assert.equal(source.paperId,edited);
    assert.equal(source.selection,'selected_version');
    assert.equal(source.audience,audience);
    const messages=query('SELECT metadata_json FROM ai_conversation_messages WHERE session_id=? AND role=? ORDER BY rowid DESC LIMIT 1',[sessionId,'user']);
    const intent=JSON.parse(messages[0].metadata_json).paperExportIntent;
    assert.equal(intent.schemaVersion,'xiaozhi.paper-export-intent.v2');
    assert.equal(intent.paperId,source.paperId);
    assert.equal(intent.digest,source.digest);
    assert.equal(fs.existsSync(file),false);
    const card=page.locator(`[data-testid="pi-office-artifact"][data-office-id="${draft.id}"]`);
    await card.getByTestId('pi-office-approve').click();
    await until(async()=>!(await snapshot()).running&&fs.existsSync(file));
    const xml=execFileSync('python',['-c',"import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read('word/document.xml'))",file],{encoding:'utf8',windowsHide:true});
    assert.match(xml,/7 分/);
    assert.doesNotMatch(xml,/同会话无关卷/);
    assert.equal(xml.includes('两边减 7 后得到 3x = 18'),audience==='teacher');
    files.push({name,size:fs.statSync(file).size,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
    check(`The ${audience} Word file is approved and installed from the exact seven-point version with the correct answer scope`);
  }
  assert.equal((await app.evaluate(()=>globalThis.paperEditRequests)).length,11);
  return files;
}
