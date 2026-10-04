import type {WebContents} from 'electron';
export function waitForBrowserState(contents:WebContents,options:{state?:string;timeoutMs?:number}):Promise<{timedOut:boolean;reason:string;elapsedMs:number}>;
