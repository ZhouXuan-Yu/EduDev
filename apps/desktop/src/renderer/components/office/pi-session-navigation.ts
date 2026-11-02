/** Reads never navigate on completion. Saved creation and active selection are separate results. */
export function createPiSessionNavigation<T extends {view: string; sessionId?: string}>(options: {
  target: () => T;
  active: () => boolean;
  navigate: (id: string) => boolean;
  open: (id: string) => Promise<void | boolean>;
}) {
  let revision = 0;
  let observed = options.target();
  type Selection = {id: string; observed: boolean};
  let selection: Selection | undefined;
  return {
    observe(target: T) {
      if (target === observed) return;
      observed = target;
      revision++;
      // One commit belongs to the selection's own navigate. Every later intent supersedes it.
      if (selection && !selection.observed && target.view === 'ai' && target.sessionId === selection.id) selection.observed = true;
      else selection = undefined;
    },
    invalidate() { revision++; selection = undefined; },
    async select(id: string) {
      const owner: Selection = {id, observed: false};
      revision++;
      selection = owner;
      if (!options.active() || !options.navigate(id)) {
        if (selection === owner) selection = undefined;
        return false;
      }
      const pending = options.open(id);
      // open synchronously invalidates older scopes before starting its read.
      selection = owner;
      const opened = await pending;
      return opened !== false && options.active() && selection === owner;
    },
    async create(create: () => Promise<string | undefined>, activate: (id: string) => Promise<void | boolean>, refresh: () => Promise<void>) {
      const owner = ++revision, target = options.target();
      // A new creation intent immediately revokes older selection/close eligibility.
      selection = undefined;
      const createdId = await create();
      if (!createdId) return;
      let activated = false;
      if (options.active()) {
        if (owner === revision && options.target() === target) activated = (await activate(createdId)) === true;
        const activation = selection, activationRevision = revision;
        // A superseded creation is still saved and must remain discoverable.
        await refresh();
        activated = activated && options.active() && (activation ? selection === activation : revision === activationRevision);
      }
      return {createdId, activated};
    },
  };
}
