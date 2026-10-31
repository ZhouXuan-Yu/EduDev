import type {PaperView} from '../../../shared/paper-blueprint';

export type PaperStage = 'blueprint' | 'review' | 'delivery';

/** Display guard only. The host remains authoritative at confirm/export time. */
export function paperDeliveryAllowed(view: PaperView | undefined, dirty: boolean): boolean {
  return !!view && !dirty && view.state === 'confirmed' && view.complete &&
    view.sourceCurrent && view.exportCurrent === true;
}
