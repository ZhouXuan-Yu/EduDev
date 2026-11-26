import {protocolHash} from '../validation';
import type {TaskPlanning} from '../../../../shared/xiaozhi-task-planning';

export function createCapabilityReplanGuard() {
    let version:number|undefined;
    let distinct=new Set<string>();
    return (value:TaskPlanning) => {
        if(value.preflight.checks.capabilities.state!=='blocked')return true;
        if(version!==value.requirementsVersion){version=value.requirementsVersion;distinct=new Set();}
        const requirements=protocolHash(value.capabilityRequirements);
        if(distinct.has(requirements)||distinct.size>=3)return false;
        distinct.add(requirements);
        return true;
    };
}
