import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat, open, unlink} from 'node:fs/promises';
import path from 'node:path';
import {BrowserWindow, dialog, shell, type IpcMain, type IpcMainInvokeEvent} from 'electron';
import {ARTIFACT_FILE_ERRORS, type ArtifactFileActionInput, type ArtifactFileActionResult, type ArtifactFileTarget} from '../../shared/artifact-file-actions';
import {ARTIFACT_COPY_MAX_BYTES, regularArtifactFile, type ResolvedArtifactFile} from './catalog-artifact-file';
import {XIAOZHI_FILES_SCHEMA} from '../../shared/xiaozhi-files';
import {approvedFile} from './workspace-authority';
import {createWorkspaceFiles, fileVersion, validFileRequest, type WorkspaceLease} from './workspace-files';

const actions = new Set(['open', 'open-with', 'reveal', 'save-as', 'location']);
const extension = (file: string) => path.extname(file).slice(1).toLowerCase();
const asRequest = (target: Extract<ArtifactFileTarget,{kind:'workspace'}>) => ({
  schemaVersion: XIAOZHI_FILES_SCHEMA, requestId: 'xifile_' + randomUUID(),
  sessionId: target.sessionId, path: target.path, workspaceVersion: target.workspaceVersion, version: target.version,
});

function valid(input: unknown): input is ArtifactFileActionInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const {target, action} = input as ArtifactFileActionInput;
  if (Object.keys(input).length !== 2 || !actions.has(action) || !target || typeof target !== 'object' || Array.isArray(target)) return false;
  if (target.kind === 'workspace') return Object.keys(target).length === 5 && validFileRequest(asRequest(target), true);
  return target.kind === 'saved' && Object.keys(target).length === 3 &&
    typeof target.sessionId === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(target.sessionId) &&
    typeof target.artifactId === 'string' && /^(?:artifact_(?:[a-f0-9-]{36}|[a-f0-9]{64})|xichange_[a-f0-9-]{36})$/i.test(target.artifactId);
}

// The file path and owner are passed as data. The Windows script is constant.
const windowsOpenWith = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class EduOpenWith {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct Info {
        public string File;
        public string FileClass;
        public uint Flags;
    }
    [DllImport("shell32.dll", ExactSpelling = true)]
    public static extern int SHOpenWithDialog(IntPtr parent, ref Info info);
    public static int Show(long owner, string file) {
        Info info = new Info { File = file, Flags = 4 };
        return SHOpenWithDialog(new IntPtr(owner), ref info);
    }
}
'@
$result = [EduOpenWith]::Show([long]$env:EDU_FILE_OWNER, $env:EDU_ARTIFACT_FILE)
if ($result -eq -2147023673) { exit 2 }
if ($result -ne 0) { exit 1 }
`;

function chooseApplication(window: BrowserWindow, file: string): Promise<boolean> {
  if (process.platform !== 'win32') throw Error('unsupported');
  const nativeHandle = window.getNativeWindowHandle();
  const owner = nativeHandle.length >= 8 ? nativeHandle.readBigUInt64LE() : BigInt(nativeHandle.readUInt32LE());
  const powershell = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  return new Promise((resolve, reject) => {
    execFile(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-EncodedCommand', Buffer.from(windowsOpenWith,'utf16le').toString('base64')], {
      windowsHide: true, maxBuffer: 64 * 1024,
      env: {...process.env, EDU_FILE_OWNER: owner.toString(), EDU_ARTIFACT_FILE: file},
    }, error => {
      if (!error || error.code === 2) resolve(!error);
      else reject(Error('failed'));
    });
  });
}

async function writeCopy(destination: string, bytes: Buffer) {
  const target = await open(destination, 'wx');
  const owned = await target.stat();
  try {
    try { await target.writeFile(bytes); }
    finally { await target.close(); }
  } catch (error) {
    const current = await lstat(destination).catch(() => undefined);
    if (current?.ino === owned.ino && current.dev === owned.dev) await unlink(destination).catch(() => {});
    throw error;
  }
}

export function registerArtifactFileActions(options: {
  ipcMain: IpcMain; allowed: (event: IpcMainInvokeEvent) => boolean;
  workspace: (id: string) => Promise<WorkspaceLease>;
  saved: (sessionId: string, id: string) => Promise<ResolvedArtifactFile>;
}) {
  const files = createWorkspaceFiles(options.workspace);
  const active = new WeakSet<Electron.WebContents>();
  const resolve = async (target: ArtifactFileTarget):Promise<ResolvedArtifactFile> => {
    if (target.kind === 'saved') return options.saved(target.sessionId,target.artifactId);
    const stat = await files.stat(asRequest(target), AbortSignal.timeout(10000));
    if (!stat.ok) throw Error(stat.error);
    const lease = await options.workspace(target.sessionId);
    if (lease.version !== target.workspaceVersion || stat.data.version !== target.version) throw Error('changed');
    return {path:approvedFile(lease.path,target.path),version:target.version};
  };
  options.ipcMain.handle('xiaozhi:artifact-file-action', async (event, input: unknown): Promise<ArtifactFileActionResult> => {
    if (!options.allowed(event)) return {ok:false,error:'permission_denied'};
    if (!valid(input)) return {ok:false,error:'invalid_input'};
    if (active.has(event.sender)) return {ok:false,error:'busy'};
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return {ok:false,error:'permission_denied'};
    active.add(event.sender);
    try {
      const {path:file, version} = await resolve(input.target);
      const initial = await regularArtifactFile(file);
      if (fileVersion(initial) !== version) throw Error('changed');
      if (!options.allowed(event)) throw Error('permission_denied');
      if (input.action === 'location') {
        const root = path.parse(file).root;
        return {ok:true, location:[root, ...file.slice(root.length).split(path.sep)]};
      }
      if (input.action === 'reveal') { shell.showItemInFolder(file); return {ok:true}; }
      if (input.action === 'open') {
        if (await shell.openPath(file)) throw Error('failed');
        return {ok:true};
      }
      if (input.action === 'open-with') return await chooseApplication(window,file) ? {ok:true} : {ok:true,cancelled:true};
      if (initial.size > ARTIFACT_COPY_MAX_BYTES) throw Error('too_large');
      const ext = extension(file);
      const picked = await dialog.showSaveDialog(window,{title:'另存为副本', defaultPath:path.basename(file), filters:[{name:ext.toUpperCase(),extensions:[ext]}]});
      if (picked.canceled || !picked.filePath) return {ok:true,cancelled:true};
      if (!options.allowed(event)) throw Error('permission_denied');
      const requested = picked.filePath;
      const destination = path.extname(requested) ? requested : requested + '.' + ext;
      if (!path.isAbsolute(destination) || extension(destination) !== ext) throw Error('unsupported');
      const checkOriginal = async () => {
        const current = await resolve(input.target);
        if (current.path !== file || current.version !== version ||
            fileVersion(await regularArtifactFile(file)) !== version) throw Error('changed');
        if (!options.allowed(event)) throw Error('permission_denied');
      };
      await checkOriginal();
      const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      let bytes: Buffer;
      try {
        if (fileVersion(await handle.stat()) !== version) throw Error('changed');
        const buffer = Buffer.alloc(initial.size + 1);
        let read = 0;
        while (read < buffer.length) {
          const part = await handle.read(buffer,read,buffer.length-read,read);
          if (!part.bytesRead) break;
          read += part.bytesRead;
        }
        if (read !== initial.size || fileVersion(await handle.stat()) !== version ||
            fileVersion(await regularArtifactFile(file)) !== version) throw Error('changed');
        bytes = buffer.subarray(0,read);
      } finally { await handle.close(); }
      await checkOriginal();
      await writeCopy(destination, bytes);
      return {ok:true,name:path.basename(destination)};
    } catch (raw) {
      const error = raw as NodeJS.ErrnoException;
      const key = error.code === 'ENOENT' || error.message === 'missing' ? 'not_found' :
        error.code === 'EEXIST' ? 'conflict' : error.message === 'no_workspace' ? 'permission_denied' : error.message;
      return {ok:false,error:Object.hasOwn(ARTIFACT_FILE_ERRORS,key) ? key as keyof typeof ARTIFACT_FILE_ERRORS : 'failed'};
    } finally { active.delete(event.sender); }
  });
}
