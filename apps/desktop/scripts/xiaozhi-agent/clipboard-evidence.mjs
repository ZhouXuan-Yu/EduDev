import assert from 'node:assert/strict';

/** Delegate to the real browser clipboard; distinguish a locked OS from UI failure. */
export async function auditAnswerClipboard({app,page,body,report,check}) {
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].focus());
  await page.bringToFront();
  const native = await app.evaluate(async({clipboard,BrowserWindow})=>{
    const marker='xiaozhi-clipboard-probe-'+Date.now(),before=clipboard.readText();
    clipboard.writeText(marker);
    await new Promise(resolve=>setTimeout(resolve,50));
    const supported=clipboard.readText()===marker;
    if(supported)clipboard.writeText(before);
    return {supported,focused:BrowserWindow.getAllWindows()[0].isFocused()};
  });
  await page.evaluate(()=>{
    const original=navigator.clipboard.writeText.bind(navigator.clipboard);
    window.__clipboardAudit={original,payload:undefined,resolved:false};
    navigator.clipboard.writeText=async value=>{
      window.__clipboardAudit.payload=value;
      await original(value);
      window.__clipboardAudit.resolved=true;
    };
  });
  try {
    await page.getByTestId('reply-copy').last().click();
    await page.getByTestId('reply-action-notice').filter({hasText:'已复制正文。'}).waitFor({timeout:10000});
    const delegated=await page.evaluate(()=>({payload:window.__clipboardAudit.payload,resolved:window.__clipboardAudit.resolved}));
    check('copy delegates only final answer to the real clipboard API',()=>{
      assert.equal(delegated.payload,body);assert.equal(delegated.resolved,true);
    });
    report.clipboard={native,delegatedChars:delegated.payload.length};
    if(native.supported){
      const deadline=Date.now()+10000;let actual='';
      do {actual=await app.evaluate(({clipboard})=>clipboard.readText());if(actual.replace(/\r\n/g,'\n')===body.replace(/\r\n/g,'\n'))break;await page.waitForTimeout(100);} while(Date.now()<deadline);
      check('OS clipboard readback matches final answer',()=>assert.equal(actual.replace(/\r\n/g,'\n'),body.replace(/\r\n/g,'\n')));
    }else{
      (report.skipped??=[]).push({name:'OS clipboard answer readback',reason:'Native Electron clipboard cannot read back its own marker in this desktop session; browser API delegation verified separately.'});
      console.log('SKIP OS clipboard readback: native roundtrip unavailable');
    }
  } finally {
    await page.evaluate(()=>{navigator.clipboard.writeText=window.__clipboardAudit.original;delete window.__clipboardAudit;});
  }
}
