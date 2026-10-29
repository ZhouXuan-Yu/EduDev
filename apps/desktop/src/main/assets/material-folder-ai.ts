import type {FolderAiGrant,FolderAiAction,FolderAiView} from '../../shared/material-folder-ai';
import type {MaterialAiRepository} from './material-ai-repository';
import type {MaterialWordRepository} from './material-word-repository';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>;ai:()=>MaterialAiRepository;word:()=>MaterialWordRepository;writer:<T>(action:(target:MaterialFolderAiRepository)=>Promise<T>)=>Promise<T>};
export class MaterialFolderAiRepository{
 constructor(private host:Host){}
 async migrate(){}
 async authorize(_input:FolderAiGrant):Promise<FolderAiView>{throw Error('not_implemented');}
 async action(_input:FolderAiAction):Promise<FolderAiView>{throw Error('not_implemented');}
 async view(_id:string):Promise<FolderAiView|undefined>{return undefined;}
 async tick(){}
}
