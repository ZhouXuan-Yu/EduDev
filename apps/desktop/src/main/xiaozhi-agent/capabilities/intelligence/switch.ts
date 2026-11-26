import type {CapabilityRequirement} from '../types';
import type {EffectRecord} from '../../effects/types';
import type {TaskView} from '../../../../shared/xiaozhi-task';
import {protocolHash} from '../validation';

export function safeProviderSwitch(input:{task:TaskView|null; checkpointId:string|undefined;
    request:CapabilityRequirement;previous:CapabilityRequirement;effects:readonly EffectRecord[]}) {
    if(!input.task || !input.checkpointId || input.task.state!=='active')return false;
    if(protocolHash(input.request)!==protocolHash(input.previous))return false;
    const relevant=input.effects.filter(effect=>effect.contract.capabilityId===input.request.capabilityId
        && ['local_write','external_effect'].includes(effect.contract.effect));
    return !relevant.some(effect=>['intent','executing','unknown','committed','reconciled','compensated'].includes(effect.state));
}
