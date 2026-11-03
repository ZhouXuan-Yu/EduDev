/** A parent must actually inspect the screenshot before writing a matching receipt.
 * Never auto-approves an image or changes a product checkbox itself.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function parentImageReviewGate(output, {timeoutMs = 180000} = {}) {
  const root = fs.realpathSync(output);
  return async ({review, figures, spec, screenshot}) => {
    const image = fs.realpathSync(screenshot);
    assert(image.startsWith(root + path.sep), 'Review screenshot must belong to this run');
    assert(figures.length > 0);
    const request = {draftId: review.id ?? review.draft?.id, revision: review.revision,
      kind: spec.kind, format: spec.format, screenshot: image,
      screenshotSha256: hash(fs.readFileSync(image)), figureDigest: hash(JSON.stringify(figures))};
    const digest = hash(JSON.stringify(request));
    const name = `image-review-${spec.kind}-${spec.format}`;
    const pending = path.join(root, name + '.request.json');
    const receipt = path.join(root, name + '.receipt.json');
    assert(!fs.existsSync(receipt), 'Cannot reuse an earlier inspection receipt');
    fs.writeFileSync(pending, JSON.stringify({...request, digest}, null, 2), {flag: 'wx'});
    console.log(JSON.stringify({phase: 'parent-image-inspection-required', request: pending, receipt}));
    const deadline = Date.now() + timeoutMs;
    while (!fs.existsSync(receipt)) {
      assert(Date.now() < deadline, 'Parent image inspection timed out; checkbox remains unchecked');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const decision = JSON.parse(fs.readFileSync(receipt, 'utf8'));
    assert.equal(decision.digest, digest, 'Inspection must bind this exact draft/screenshot');
    assert.equal(decision.reviewed, true, 'Parent declined or did not inspect the image');
    assert.equal(hash(fs.readFileSync(image)), request.screenshotSha256, 'Screenshot changed during inspection');
    return {reviewed: true, evidence: [image, pending, receipt]};
  };
}
