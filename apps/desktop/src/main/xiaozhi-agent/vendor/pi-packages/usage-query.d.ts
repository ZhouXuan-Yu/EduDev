export function queryDeepSeekBalance(apiKey:string,signal:AbortSignal,guard:()=>Promise<void>):Promise<{capturedAt:number;metrics:Array<{id:string;value:string|number;currency?:string}>}>;
