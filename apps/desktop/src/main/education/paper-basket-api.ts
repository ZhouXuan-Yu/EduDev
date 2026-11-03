import type {PaperBasketV2Api} from '../../shared/paper-basket-v2';
import {validPaperBasketV2Read,validPaperBasketV2List,validPaperBasketV2Create,validPaperBasketV2Candidate,validPaperBasketV2Mutation,validPaperBasketV2Snapshot,validPaperBasketV2Import} from '../../shared/paper-basket-v2';
import type {PaperBasketV2Repository} from './paper-basket-v2-repository';
import type {IpcMain, IpcMainInvokeEvent} from 'electron';
import {
  validPaperBasketCandidate, validPaperBasketCreate, validPaperBasketList,
  validPaperBasketMutation, validPaperBasketRead, validPaperBasketSnapshot,
  type PaperBasketApi, type PaperBasketResult,
} from '../../shared/paper-basket';
import {PAPER_ERRORS, type PaperError} from '../../shared/paper-blueprint';
import type {PaperBasketRepository} from './paper-basket-repository';

async function basketResult<T>(work: () => Promise<T>): Promise<PaperBasketResult<T>> {
  try {
    return {ok: true, value: await work()};
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code: PaperError = Object.prototype.hasOwnProperty.call(PAPER_ERRORS, message)
      ? message as PaperError : 'unavailable';
    return {ok: false, error: code};
  }
}

export function createPaperBasketApi(repository: PaperBasketRepository, writeLease: (sessionId: string) => () => boolean): PaperBasketApi;
export function createPaperBasketApi(repository: PaperBasketRepository, writeLease: (sessionId: string) => () => boolean, v2: PaperBasketV2Repository,changed?:(sessionId:string,ids:string[])=>Promise<void>): PaperBasketApi & PaperBasketV2Api;
export function createPaperBasketApi(
  repository: PaperBasketRepository,
  writeLease: (sessionId: string) => () => boolean,
  v2?: PaperBasketV2Repository,
  changed?:(sessionId:string,ids:string[])=>Promise<void>,
): PaperBasketApi & Partial<PaperBasketV2Api> {
  return {
    ...(v2 ? {
    listPaperBasketsV2: input => basketResult(async()=>{if(!validPaperBasketV2List(input))throw Error('invalid_input');if(!v2)throw Error('unavailable');return v2.list(input);}),
    readPaperBasketV2: input => basketResult(async()=>{if(!validPaperBasketV2Read(input))throw Error('invalid_input');if(!v2)throw Error('unavailable');return v2.read(input);}),
    readPaperBasketCandidateV2: input => basketResult(async()=>{if(!validPaperBasketV2Candidate(input))throw Error('invalid_input');if(!v2)throw Error('unavailable');return v2.candidate(input);}),
    createPaperBasketV2: input => basketResult(async()=>{if(!validPaperBasketV2Create(input))throw Error('invalid_input');if(!v2)throw Error('unavailable');return v2.create(input,writeLease(input.sessionId));}),
    mutatePaperBasketV2: input => basketResult(async()=>{if(!validPaperBasketV2Mutation(input))throw Error('invalid_input');if(!v2)throw Error('unavailable');return v2.mutate(input,writeLease(input.sessionId));}),
    createPaperFromBasketV2: input => basketResult(async()=>{if(!validPaperBasketV2Snapshot(input))throw Error('invalid_input');if(!v2)throw Error('unavailable');return v2.createSnapshot(input,writeLease(input.sessionId));}),
    importPaperToBasketV2: input => basketResult(async()=>{if(!validPaperBasketV2Import(input))throw Error('invalid_input');return v2.importPaper(input,writeLease(input.sessionId));}),
    confirmPaperBasketV2: input => basketResult(async()=>{if(!validPaperBasketV2Snapshot(input))throw Error('invalid_input');const result=await v2.confirm(input,writeLease(input.sessionId));await changed?.(input.sessionId,[result.paper.id,...result.replacedPaperIds]);return result;}),
    } satisfies PaperBasketV2Api : {}),
    listPaperBaskets: input => basketResult(async () => {
      if (!validPaperBasketList(input)) throw new Error('invalid_input');
      return repository.list(input);
    }),
    readPaperBasket: input => basketResult(async () => {
      if (!validPaperBasketRead(input)) throw new Error('invalid_input');
      return repository.read(input);
    }),
    readPaperBasketCandidate: input => basketResult(async () => {
      if (!validPaperBasketCandidate(input)) throw new Error('invalid_input');
      return repository.candidate(input);
    }),
    createPaperBasket: input => basketResult(async () => {
      if (!validPaperBasketCreate(input)) throw new Error('invalid_input');
      return repository.create(input, writeLease(input.sessionId));
    }),
    mutatePaperBasket: input => basketResult(async () => {
      if (!validPaperBasketMutation(input)) throw new Error('invalid_input');
      return repository.mutate(input, writeLease(input.sessionId));
    }),
    createPaperFromBasket: input => basketResult(async () => {
      if (!validPaperBasketSnapshot(input)) throw new Error('invalid_input');
      return repository.createSnapshot(input, writeLease(input.sessionId));
    }),
  };
}

export function registerPaperBasketIpc(options: {
  ipcMain: IpcMain;
  allowed: (event: IpcMainInvokeEvent) => boolean;
  host: PaperBasketApi & Partial<PaperBasketV2Api>;
}) {
  function register<Input, Output>(channel: string, action: (input: Input) => Promise<Output>) {
    options.ipcMain.handle(channel, (event, input: Input) => {
      if (!options.allowed(event)) return {ok: false, error: 'permission_denied'};
      return action(input);
    });
  }

  if(options.host.listPaperBasketsV2) register('education:paper-basket-v2-list',options.host.listPaperBasketsV2);
  if(options.host.readPaperBasketV2) register('education:paper-basket-v2-read',options.host.readPaperBasketV2);
  if(options.host.readPaperBasketCandidateV2) register('education:paper-basket-v2-candidate',options.host.readPaperBasketCandidateV2);
  if(options.host.createPaperBasketV2) register('education:paper-basket-v2-create',options.host.createPaperBasketV2);
  if(options.host.mutatePaperBasketV2) register('education:paper-basket-v2-mutate',options.host.mutatePaperBasketV2);
  if(options.host.createPaperFromBasketV2) register('education:paper-basket-v2-snapshot',options.host.createPaperFromBasketV2);
  if(options.host.importPaperToBasketV2)register('education:paper-basket-v2-import',options.host.importPaperToBasketV2);
  if(options.host.confirmPaperBasketV2)register('education:paper-basket-v2-confirm',options.host.confirmPaperBasketV2);
  register('education:paper-basket-list', options.host.listPaperBaskets);
  register('education:paper-basket-read', options.host.readPaperBasket);
  register('education:paper-basket-candidate', options.host.readPaperBasketCandidate);
  register('education:paper-basket-create', options.host.createPaperBasket);
  register('education:paper-basket-mutate', options.host.mutatePaperBasket);
  register('education:paper-basket-snapshot', options.host.createPaperFromBasket);
}
