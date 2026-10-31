import assert from 'node:assert/strict';

/** Open the real shared disclosure and verify its controlled content is visible.
 * Root data-testid stays on Disclosure.Root; its own trigger precedes nested ones.
 */
export async function openMaterialDisclosure(card){
 const trigger=card.locator('button[aria-expanded][aria-controls]').first();
 if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
 assert.equal(await trigger.getAttribute('aria-expanded'),'true','Material disclosure failed to expand');
 const contentId=await trigger.getAttribute('aria-controls');assert(contentId,'Missing disclosure content relationship');
 await card.page().waitForFunction(id=>{const node=document.getElementById(id);return node&&!node.hidden&&node.getClientRects().length>0;},contentId);
}
