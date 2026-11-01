import assert from 'node:assert/strict';

/** Only the official trigger owns expansion; never synthesize native open state. */
export async function expandDisclosure(root,name){
 const trigger=root.getByRole('button',{name});
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
}
export async function openPaperHistory(page){
 const history=page.getByTestId('paper-history');
 if(await history.count())await expandDisclosure(history,/^已保存的组卷记录/);
}
