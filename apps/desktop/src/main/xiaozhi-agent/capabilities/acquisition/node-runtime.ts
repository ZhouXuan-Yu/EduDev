import fs from 'node:fs/promises';
import path from 'node:path';
import {digest} from '../../permissions/resources';
import {hashCapabilityFile, hashCapabilityBytes} from './file-hash';
import {NODE_RECIPE} from './recipes';
import type {PublicFetch} from './npm-source';

/** One fixed Node recipe is shared by MCP and Extension preparation. */
export async function prepareManagedNode(options: {directory: string; fetcher: PublicFetch; signal: AbortSignal;
  assert: () => Promise<void>; localNode?: string}) {
  await options.assert();
  const destination = path.join(options.directory, 'node.exe');
  let copied = false;
  if (options.localNode) {
    const stat = await fs.lstat(options.localNode).catch(() => null);
    if (stat?.isFile() && !stat.isSymbolicLink() && stat.size === NODE_RECIPE.bytes
        && await hashCapabilityFile(options.localNode, options.signal) === NODE_RECIPE.sha256) {
      await fs.copyFile(options.localNode, destination, fs.constants.COPYFILE_EXCL); copied = true;
    }
  }
  if (!copied) {
    const bytes = await options.fetcher(NODE_RECIPE.sourceUrl, options.signal, NODE_RECIPE.bytes, 'application/octet-stream');
    if (bytes.length !== NODE_RECIPE.bytes || (await hashCapabilityBytes(bytes)).toString('hex') !== NODE_RECIPE.sha256) throw Error('checksum_mismatch');
    await fs.writeFile(destination, bytes, {flag: 'wx'});
  }
  if (await hashCapabilityFile(destination, options.signal) !== NODE_RECIPE.sha256) throw Error('checksum_mismatch');
  const license = await options.fetcher(NODE_RECIPE.licenseUrl, options.signal, 512 * 1024, 'text/plain');
  if (digest(license) !== NODE_RECIPE.licenseHash) throw Error('source_changed');
  await fs.writeFile(path.join(options.directory, 'NODE-LICENSE.txt'), license, {flag: 'wx'});
  await options.assert();
}
