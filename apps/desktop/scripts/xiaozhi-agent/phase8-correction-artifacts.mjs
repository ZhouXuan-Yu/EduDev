import fs from 'node:fs';
import path from 'node:path';

const practice = '合成练习：3/4 + 1/4 = 1';
const draftCards = {
  bundle: ['pi-delivery-bundle', 'data-bundle-id', 'pi-delivery-approve'],
  office: ['pi-office-artifact', 'data-office-id', 'pi-office-approve'],
  text: ['pi-text-change', 'data-change-id', 'pi-text-approve'],
};

/** Changes outside these named synthetic outputs require a human decision. */
export function plannedSyntheticSave({task, kind, names, existing, after, isEdit, previous}) {
  if (names.some(name => !name || /[\\/:\x00-\x1f]/u.test(name) || name.includes('..') || name.trim() !== name)) return false;
  if (task === 'Q7') {
    return kind === 'text' && names.length === 1 && names[0] === 'practice.txt' && !isEdit && !existing.length
      && after === practice;
  }
  if (task !== 'Q3') return false;
  const extensions = names.map(name => path.extname(name).toLowerCase()).sort().join(',');
  if (extensions !== {bundle:'.html,.pptx',office:'.pptx',text:'.html'}[kind]) return false;
  if (!existing.length) return !isEdit;
  return kind === 'text' && isEdit && existing.length === 1
    && previous.some(item => item.files.includes(existing[0]) && !item.edit)
    && !previous.some(item => item.files.includes(existing[0]) && item.edit);
}

async function visibleFileNames(card, kind) {
  const files = kind === 'bundle' ? await card.getByTestId('pi-delivery-file').all() : [card];
  return Promise.all(files.map(async file => {
    const titled = await file.locator('[title]').evaluateAll(nodes => nodes.map(node => node.title)
      .find(value => /\.(?:pptx|html|txt)$/iu.test(value)));
    return titled ?? (await file.innerText()).split('\n').find(value => /\.(?:pptx|html|txt)$/iu.test(value));
  }));
}

export async function confirmSyntheticArtifact(page, task, workspace, decisions, sessionId) {
  const kinds = task === 'Q3' ? ['bundle','office','text'] : task === 'Q7' ? ['text'] : [];
  for (const kind of kinds) {
    const [testId, idAttribute, approve] = draftCards[kind];
    const pending = page.getByTestId(testId).and(page.locator('[data-state="pending"]'));
    // Bundle-owned drafts stay in the bundle; its readiness is enforced by the original control.
    const cards = kind === 'bundle' ? await pending.all()
      : await pending.and(page.locator(':not([data-testid="pi-delivery-bundle"] *)')).all();
    for (const card of cards) {
      const id = await card.getAttribute(idAttribute);
      if (decisions.some(item => item.id === id)) continue;
      const button = card.getByTestId(approve);
      if (await button.count() !== 1 || !await button.isVisible() || !await button.isEnabled()) continue;
      const revision = await card.getAttribute('data-revision');
      const names = await visibleFileNames(card, kind);
      const existing = names.filter(name => name && !/[\\/:]/u.test(name) && fs.existsSync(path.join(workspace, name)));
      const review = task === 'Q7' && id ? await page.evaluate(async ({sessionId, changeId}) => {
        const response = await window.omniEdu.reviewXiaozhiChange({sessionId, changeId});
        if (!response?.ok) return null;
        const {id, revision, after} = response.value;
        return {id, revision, after};
      }, {sessionId, changeId:id}) : null;
      const isEdit = kind === 'text' && await card.getByText('修改文件', {exact:true}).count() === 1;
      if (!id || !/^[A-Za-z0-9_-]+$/u.test(id)
          || task === 'Q7' && (!review || review.id !== id || String(review.revision) !== revision)
          || !plannedSyntheticSave({task,kind,names,existing,after:review?.after,isEdit,previous:decisions})) throw Error('phase8_unexpected_correction_draft');
      const startedAt = performance.now();
      await button.click({timeout:5000});
      decisions.push({id,kind,revision,files:names,edit:isEdit,startedAt,completedAt:performance.now()});
      return;
    }
  }
}
