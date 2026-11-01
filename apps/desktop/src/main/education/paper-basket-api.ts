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

export function createPaperBasketApi(
  repository: PaperBasketRepository,
  writeLease: (sessionId: string) => () => boolean,
): PaperBasketApi {
  return {
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
  host: PaperBasketApi;
}) {
  function register<Input, Output>(channel: string, action: (input: Input) => Promise<Output>) {
    options.ipcMain.handle(channel, (event, input: Input) => {
      if (!options.allowed(event)) return {ok: false, error: 'permission_denied'};
      return action(input);
    });
  }

  register('education:paper-basket-list', options.host.listPaperBaskets);
  register('education:paper-basket-read', options.host.readPaperBasket);
  register('education:paper-basket-candidate', options.host.readPaperBasketCandidate);
  register('education:paper-basket-create', options.host.createPaperBasket);
  register('education:paper-basket-mutate', options.host.mutatePaperBasket);
  register('education:paper-basket-snapshot', options.host.createPaperFromBasket);
}
