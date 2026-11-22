import type {AdapterState} from './contract';

const transitions: Record<AdapterState, readonly AdapterState[]> = {
    discovered: ['validated','revoked','uninstalled'],
    validated: ['installed','revoked','uninstalled'],
    installed: ['registered','revoked','uninstalled'],
    registered: ['activated','revoked','uninstalled'],
    activated: ['available','suspended','revoked','uninstalled'],
    available: ['suspended','revoked','uninstalled'],
    suspended: ['activated','revoked','uninstalled'],
    revoked: ['uninstalled'],
    uninstalled: [],
};

export function assertAdapterTransition(from: AdapterState, to: AdapterState) {
    if (!transitions[from].includes(to)) throw Error('capability_adapter_transition');
}

export const adapterAdmissionOrder = ['validated','installed','registered','activated','available'] as const;
