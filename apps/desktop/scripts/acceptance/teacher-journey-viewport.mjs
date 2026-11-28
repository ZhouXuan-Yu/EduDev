import assert from 'node:assert/strict';
import path from 'node:path';

const flag = process.argv.find(arg => arg.startsWith('--teacher-viewport='));
const viewport = flag?.split('=')[1];
if (flag) assert(['1366x768', '1920x1080'].includes(viewport), 'Unknown acceptance viewport');

export async function sizeTeacherJourney(page) {
  if (!viewport) return;
  const [width, height] = viewport.split('x').map(Number);
  await page.setViewportSize({width, height});
}

export async function captureTeacherAction(page, control, root, label, report) {
  if (!viewport) return;
  await control.click({trial: true, timeout: 10000});
  const box = await control.boundingBox();
  const size = await page.evaluate(() => ({width: innerWidth, height: innerHeight}));
  assert.equal(size.width + 'x' + size.height, viewport);
  assert(box && box.x + box.width / 2 >= 0 && box.y + box.height / 2 >= 0 &&
    box.x + box.width / 2 < size.width && box.y + box.height / 2 < size.height,
    'The teacher action must be reachable in the requested viewport');
  const screenshot = label + '-' + viewport + '.png';
  await page.screenshot({path: path.join(root, screenshot), animations: 'disabled'});
  (report.viewportActions ??= []).push({label, size, box, screenshot});
}
