import {computeCompactionReserveTokens} from '../vendor/hana/core/session-compaction-runtime';

export function createCompactionBudget(window: number, maxOutput: number, now=Date.now) {
    const reserve=Math.min(computeCompactionReserveTokens(window),Math.floor(window/2));
    const high=window-reserve;
    const low=Math.max(1,high-Math.min(2048,Math.max(maxOutput,Math.ceil(reserve/4))));
    let previous=0,lastCompaction=-Infinity,rearm=true;
    return {
        low,high,
        observe(projected:number) {
            const growth=Math.max(0,projected-previous);
            previous=projected;
            if(projected<=low)rearm=true;
            if(projected>window)return true;
            return projected>=high
                && (rearm || growth>=(high-low)/2)
                && now()-lastCompaction>=500;
        },
        committed(){lastCompaction=now();rearm=false;},
    };
}
