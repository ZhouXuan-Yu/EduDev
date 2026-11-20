import {lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import type {DocumentArtifactExportResult} from '../../shared/contracts';
import {isArtifactFileName} from '../../shared/artifact-file-actions';
import {hashFileSha256} from '../local-file-security';
import {fileVersion} from './workspace-files';

export type ResolvedArtifactFile = {path:string;version:string};
export const ARTIFACT_COPY_MAX_BYTES = 64 * 1024 * 1024;

export async function regularArtifactFile(file:string){
  if(!path.isAbsolute(file))throw Error('permission_denied');
  const stat=await lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||path.relative(file,await realpath(file)))throw Error('permission_denied');
  if(!isArtifactFileName(path.basename(file)))throw Error('unsupported');
  return stat;
}

/** Older exports record the exact selected path, byte count and hash in the catalog. */
export async function verifyCatalogArtifactFile(
  sessionId:string,read:()=>Promise<DocumentArtifactExportResult|null>,authorize:()=>Promise<void>,
):Promise<ResolvedArtifactFile>{
  const original=await read();
  if(!original||original.sessionId!==sessionId||original.status!=='exported')throw Error('permission_denied');
  const file=original.filePath;
  const before=await regularArtifactFile(file),version=fileVersion(before);
  if(before.size!==original.fileSize||!/^[a-f0-9]{64}$/.test(original.contentHash))throw Error('changed');
  if(before.size>ARTIFACT_COPY_MAX_BYTES)throw Error('too_large');
  const hash=await hashFileSha256(file,AbortSignal.timeout(10000));
  const current=await read();
  await authorize();
  if(current?.sessionId!==sessionId||current.status!=='exported'||current.filePath!==file||
    current.contentHash!==hash||current.updatedAt!==original.updatedAt||original.contentHash!==hash||
    fileVersion(await regularArtifactFile(file))!==version)throw Error('changed');
  return {path:file,version};
}
