import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {gt, valid} from 'semver';
import {hashFileSha256} from '../local-file-security';
import {hasValidWindowsSignature} from './windows-authenticode';
import type {WindowsUpdateCandidate} from '../../shared/windows-update';

export const windowsReleaseUrl = 'https://api.github.com/repos/ZhouXuan-Yu/EduDev/releases/latest';
const installerName = /^Xiaozhi-Setup-(\d+\.\d+\.\d+)-x64\.exe$/i;
const releaseLimit = 512 * 1024;
type FetchRelease = (url: string, init: RequestInit) => Promise<Response>;
const dataVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0x7fff_ffff;
const object = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

async function readRelease(fetchRelease: FetchRelease) {
  const response = await fetchRelease(windowsReleaseUrl, {
    signal: AbortSignal.timeout(12000), redirect: 'error', credentials: 'omit',
    headers: {Accept:'application/vnd.github+json', 'User-Agent':'OmniEdu-Xiaozhi-Desktop'},
  });
  if (response.status === 404) return undefined;
  if (!response.ok || !response.body) throw Error('release_unavailable');
  const reader = response.body.getReader();
  const content: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > releaseLimit) throw Error('release_unavailable');
      content.push(value);
    }
    return object(JSON.parse(Buffer.concat(content).toString('utf8')));
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function matchingAsset(release: Record<string, unknown>, version: string) {
  if (release.draft !== false || release.prerelease !== false ||
    ![version, 'v' + version].includes(String(release.tag_name)) || !Array.isArray(release.assets)) return;
  const name = `Xiaozhi-Setup-${version}-x64.exe`;
  const matches = release.assets.map(object).filter(asset => asset?.name === name && asset.state === 'uploaded');
  if (matches.length !== 1) return;
  const asset = matches[0];
  const digest = typeof asset?.digest === 'string' && /^sha256:([a-f0-9]{64})$/i.exec(asset.digest)?.[1];
  if (!digest || !Number.isSafeInteger(asset?.size) || Number(asset?.size) <= 0) return;
  return {sha256:digest.toLowerCase(), size:Number(asset?.size)};
}

function compatibleDataVersion(release: Record<string, unknown>, currentVersion: string, sourceDataVersion: number) {
  if (typeof release.body !== 'string') return;
  const blocks = [...release.body.matchAll(/<!-- xiaozhi-update-v1\s+([\s\S]{1,4096}?)\s*-->/g)];
  if (blocks.length !== 1) return;
  try {
    const matrix = object(JSON.parse(blocks[0][1]));
    if (!matrix || !dataVersion(matrix.targetDataVersion) ||
      !Array.isArray(matrix.sources) || matrix.sources.length > 32) return;
    if (matrix.sources.some(entry => object(entry)?.appVersion === currentVersion &&
      object(entry)?.dataVersion === sourceDataVersion)) return matrix.targetDataVersion;
  } catch {
    return;
  }
}

async function regularFile(file: string) {
  const stat = await fs.lstat(file, {bigint:true});
  if (!stat.isFile() || stat.nlink !== 1n || stat.size <= 0n || stat.size > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('file_unavailable');
  return stat;
}

/** Only the application-selected local file and the fixed official release metadata are read. */
export async function inspectWindowsInstaller(file: string, currentVersion: string, sourceDataVersion: number,
  fetchRelease: FetchRelease): Promise<WindowsUpdateCandidate> {
  const candidate: WindowsUpdateCandidate = {
    id: randomUUID(), fileName:path.basename(file), currentVersion, dataVersion:sourceDataVersion, status:'invalid_name',
  };
  const version = installerName.exec(candidate.fileName)?.[1];
  if (!version || !valid(version)) return candidate;
  candidate.targetVersion = version;
  if (!valid(currentVersion) || !gt(version, currentVersion)) return {...candidate,status:'same_or_older'};
  try {
    const before = await regularFile(file);
    if (!await hasValidWindowsSignature(file)) return {...candidate,status:'signature_invalid'};
    let release;
    try { release = await readRelease(fetchRelease); }
    catch { return {...candidate,status:'release_unavailable'}; }
    if (!release) return {...candidate,status:'release_missing'};
    const asset = matchingAsset(release, version);
    if (!asset) return {...candidate,status:'release_missing'};
    const targetDataVersion = compatibleDataVersion(release,currentVersion,sourceDataVersion);
    if (targetDataVersion === undefined) return {...candidate,status:'incompatible'};
    const sha256 = await hashFileSha256(file);
    const after = await regularFile(file);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs ||
      asset.size !== Number(after.size) || asset.sha256 !== sha256) return {...candidate,status:'package_mismatch'};
    return {...candidate,status:'ready',sha256,targetDataVersion};
  } catch {
    return {...candidate,status:'file_unavailable'};
  }
}

export async function assertUnchangedUpdateFile(file: string, sha256: string) {
  await regularFile(file);
  if (await hashFileSha256(file) !== sha256) throw Error('安装包内容已更改，请重新检查。');
}
