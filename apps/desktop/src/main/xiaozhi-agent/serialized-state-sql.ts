import type {Sql} from './session-state';

/** Queue before opening another writer connection. Waiting BEGIN IMMEDIATE calls
 * must not occupy libuv's workers needed by the current transaction's SQL/IO.
 * Work inside the transaction uses its original same-connection adapter. */
export function serializeStateWrites(source:Sql):Sql{
  let tail:Promise<void>=Promise.resolve();
  function write<T>(action:()=>Promise<T>):Promise<T>{
    const pending=tail.then(action);
    tail=pending.then(()=>undefined,()=>undefined);
    return pending;
  }
  return{
    all:(...args)=>source.all(...args),
    run:(...args)=>write(()=>source.run(...args)),
    ...(source.change?{change:(...args:Parameters<NonNullable<Sql['change']>>)=>write(()=>source.change!(...args))}:{}),
    ...(source.transaction?{transaction:<T>(action:(work:Sql)=>Promise<T>)=>write(()=>source.transaction!(action))}:{}),
  };
}
