/** Actual existing Electron page only. No model, business mutation or geometry override. */
import assert from 'node:assert/strict';
import path from 'node:path';

export async function verifyPaperPreviewViewport({app,page,output,report}) {
  const viewport=page.getByTestId('paper-layout-preview-viewport');
  const sheet=page.getByTestId('paper-layout-preview-sheet');
  assert.equal(await viewport.count(),1);assert.equal(await sheet.count(),1);
  const geometry=()=>sheet.evaluate(el=>{
    const s=getComputedStyle(el);return {width:s.width,minHeight:s.minHeight,font:s.fontSize,
      padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft],
      columns:getComputedStyle(el.firstElementChild).columnCount,gap:getComputedStyle(el.firstElementChild).columnGap};
  });
  const original=await geometry();
  const previous=await page.evaluate(()=>[innerWidth,innerHeight]);
  const left=page.getByRole('button',{name:'向左查看',exact:true});
  const right=page.getByRole('button',{name:'向右查看',exact:true});
  const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  report.previewViewport=[];
  try {
    for(const size of [[800,768],[1366,768],[1920,1080]]) {
      await app.evaluate(({BrowserWindow},v)=>BrowserWindow.getAllWindows()[0].setContentSize(...v),size);
      await page.waitForFunction(v=>innerWidth===v[0]&&innerHeight===v[1],size);
      await viewport.scrollIntoViewIfNeeded();await viewport.focus();
      await page.keyboard.press('Home');await frame();
      assert.deepEqual(await geometry(),original,'Window resize must not change the actual paper geometry');
      const measure=()=>viewport.evaluate(el=>({left:el.scrollLeft,width:el.clientWidth,scrollWidth:el.scrollWidth,
        pageWidth:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,
        focused:document.activeElement===el,outline:getComputedStyle(el).outlineStyle}));
      const start=await measure();
      assert(start.documentWidth<=start.pageWidth+1&&start.bodyWidth<=start.pageWidth+1,'Paper must not cause page-wide overflow');
      assert.equal(start.left,0);assert(await left.isDisabled());
      assert.equal(await viewport.getAttribute('role'),'region');
      assert(await viewport.getAttribute('aria-describedby'),'Keyboard instructions must be associated');
      if(start.scrollWidth>start.width+1) {
        assert(await right.isEnabled());await right.click();await frame();
        const moved=await measure();assert(moved.left>0,'Visible right control must actually scroll');
        await viewport.focus();await page.keyboard.press('End');await frame();
        const end=await measure();assert(end.left+end.width>=end.scrollWidth-1);assert(await right.isDisabled());
        await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await frame();
        assert((await measure()).left>0,'Keyboard arrow must actually scroll');
        await page.keyboard.press('Home');await frame();
      } else {assert(await right.isDisabled());}
      assert((await measure()).focused,'Focus stays in the paper region after keyboard use');
      assert.notEqual((await measure()).outline,'none','Keyboard focus must be visible');
      const file=`preview-viewport-${size[0]}.png`;
      await page.screenshot({path:path.join(output,file)});
      report.previewViewport.push({size,start,geometry:await geometry(),file,pass:true});
    }
  } finally {
    await app.evaluate(({BrowserWindow},v)=>BrowserWindow.getAllWindows()[0].setContentSize(...v),previous);
    await page.waitForFunction(v=>innerWidth===v[0]&&innerHeight===v[1],previous);
  }
}
