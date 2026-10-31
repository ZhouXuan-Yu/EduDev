/** Explicit, local-only setup via the real reference UI, within this run's fresh owner. */
import assert from 'node:assert/strict';
import {getJson} from './openmaic-live-ui.mjs';
import {publicSettings} from './openmaic-public-content.mjs';

const documentSlot=settings=>settings.slots.find(s=>s.slot==='document');
const otherSlots=settings=>settings.slots.filter(s=>s.slot!=='document');
const isLocal=slot=>slot?.status==='assigned'&&[slot.providerId,slot.registryId].includes('unpdf');

export async function configureLocalPdf({page,settings,until,report}){
 const original=documentSlot(settings);
 if(isLocal(original))return {settings};
 assert.equal(original?.status,'unassigned','UI setup only owns an unassigned document slot; it must not replace an existing service');
 assert(!original.locked,'Document slot is deployment-locked');
 const evidence={scope:'Fresh browser context/owner created by this script; no imported cookies/profile',before:original,configured:false,restored:false};
 report.localExtractorSetup=evidence;
 await page.getByTestId('course-material-button').click();
 // Radix's real material Popover has role=dialog; its only Select is the extractor.
 const popover=page.getByRole('dialog').filter({has:page.locator('input[type="file"]')});
 const select=popover.getByRole('combobox');assert.equal(await select.count(),1,'Document extractor control missing or ambiguous');
 await select.click();
 const option=page.getByRole('option',{name:/^unpdf(?:\s|$)/i});
 assert.equal(await option.count(),1,'Built-in unpdf choice is not available; no external-provider fallback');
 await option.click();
 let after;
 await until(async()=>{after=publicSettings(await getJson(page,'/api/model-config'));return isLocal(documentSlot(after));},'real UI saves local unpdf document assignment');
 assert.deepEqual(otherSlots(after),otherSlots(settings),'Local extractor setup changed another capability');
 evidence.after=documentSlot(after);evidence.configured=true;
 await page.keyboard.press('Escape');
 return {settings:after,restore:async()=>{
  // Restore only the slot this fresh owner changed. The added keyless built-in
  // provider may remain in this owned workspace; never delete another provider.
  await page.goto(new URL('/',page.url()).href,{waitUntil:'domcontentloaded'});
  const settingsButton=page.getByRole('button').filter({has:page.locator('svg.lucide-settings')});
  assert.equal(await settingsButton.count(),1,'Reference settings entry missing');await settingsButton.click();
  await page.getByTestId('settings-nav-course-models').click();
  await page.locator('button[data-slot-id="document"]').click();
  await page.locator('[data-slot-picker="document"]').getByRole('button',{name:/^清除单独设置|^Clear (?:individual |own )?setting/i}).click();
  let restored;
  await until(async()=>{restored=publicSettings(await getJson(page,'/api/model-config'));return documentSlot(restored)?.status===original.status;},'restore owned document slot through UI');
  assert.deepEqual(otherSlots(restored),otherSlots(settings),'Restoring local extractor changed another capability');
  evidence.restored=true;evidence.retained='Only the keyless local unpdf provider in this fresh owner; no model/key/provider deletion';
 }};
}
