type Mode = 'steer' | 'followUp';
type Item = { id: string; text: string; mode: Mode; revision: number; dispatching: boolean; queueOrder:number };
type Native = { steer: (text: string) => Promise<void>; followUp: (text: string) => Promise<void> };

/** Mutable teacher commands are handed to Pi only at its supported turn seam.
 * Pi still owns steering/follow-up delivery and the only model loop.
 */
export function createPiInstructionQueue(options: { native: Native; current: () => boolean;
  matchesText?: (original: string, delivered: string) => boolean;
  dispatch: (id: string) => Promise<boolean> }) {
  const pending = new Map<string, Item>();
  const reservations = new Map<string, { promise: Promise<void>; finish: () => void }>();
  let offered: Item | undefined;
  let sequence=0;
  const ordered=()=>[...pending.values()].filter(item=>!item.dispatching).sort((a,b)=>a.queueOrder-b.queueOrder);
  return {
    nextOrder:()=>++sequence,
    enqueue(id: string, text: string, mode: Mode, revision = 0, queueOrder = ++sequence) {
      if (!options.current() || pending.has(id)) throw new Error('busy');
      sequence=Math.max(sequence,queueOrder);
      pending.set(id, { id, text, mode, revision, queueOrder, dispatching: false });
    },
    reserve(id: string, revision: number) {
      const item = pending.get(id);
      if (!options.current() || !item || item.dispatching || reservations.has(id)) throw new Error('permission_denied');
      if(reservations.size)throw Error('busy');
      if (item.revision !== revision) throw new Error('command_conflict');
      let done!: () => void;
      const entry = {promise:new Promise<void>(resolve => { done = resolve; }),finish:()=>done()};
      reservations.set(id, entry);
      let released = false;
      return {
        positionBefore(beforeId:string|null){
          const others=ordered().filter(other=>other!==item&&other.mode===item.mode);
          const index=beforeId===null?others.length:others.findIndex(other=>other.id===beforeId);
          if(index<0)throw Error('command_conflict');
          const left=others[index-1]?.queueOrder,right=others[index]?.queueOrder;
          const position=right===undefined?++sequence:left===undefined?right-1:(left+right)/2;
          if(position===left||position===right)throw Error('command_conflict');
          return position;
        },
        commit(patch?: Partial<Pick<Item,'text'|'mode'|'queueOrder'>>) {
          if (!options.current() || pending.get(id) !== item) return false;
          if (patch) Object.assign(item, patch, { revision: revision + 1 }); else pending.delete(id);
          return true;
        },
        release() { if (!released) { released = true; if(reservations.get(id) === entry)reservations.delete(id); done(); } },
      };
    },
    async prepare(hasToolCalls: boolean, signal?: AbortSignal) {
      while (reservations.size) { await Promise.all([...reservations.values()].map(entry=>entry.promise)); signal?.throwIfAborted(); }
      if (!options.current()) throw new Error('cancelled');
      if (offered) throw new Error('configuration');
      const items=ordered();
      const item = items.find(value => value.mode === 'steer')
        || (!hasToolCalls ? items.find(value => value.mode === 'followUp') : undefined);
      if (!item) return;
      // No await between selection and locking: IPC mutations cannot take this item.
      item.dispatching = true; offered = item;
      if (!await options.dispatch(item.id) || !options.current()) throw new Error('cancelled');
      signal?.throwIfAborted();
      await (item.mode === 'steer' ? options.native.steer(item.text) : options.native.followUp(item.text));
    },
    consume(text: string) {
      // Only one ID is offered per native turn, including identical text commands.
      if (!offered || (offered.text !== text && !options.matchesText?.(offered.text, text))) return undefined;
      const id = offered.id; pending.delete(id); offered = undefined; return id;
    },
    clear() { pending.clear(); offered = undefined; for(const entry of reservations.values())entry.finish(); reservations.clear(); },
  };
}
