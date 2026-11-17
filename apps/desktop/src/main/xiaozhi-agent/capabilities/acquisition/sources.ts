import {protocolHash} from '../validation';
import type {CapabilityCandidate, DiscoverySource, AcquisitionView} from '../../../../shared/xiaozhi-acquisition';
import type {AcquisitionState} from './state';
import type {PublicFetch} from './npm-source';
import {FILESYSTEM_RECIPE} from './recipes';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, maximum = 1000) => typeof value === 'string' ? value.replace(/[\x00-\x1f]/gu, ' ').slice(0, maximum) : '';
function repository(value: unknown) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return url.href;
  } catch {return null;}
}
export function reviewedFilesystemCandidate(): CapabilityCandidate {
  const source = 'reviewed' as const, externalId = FILESYSTEM_RECIPE.name, version = FILESYSTEM_RECIPE.version;
  return {id: 'xicandidate_' + protocolHash({source, externalId, version}), source, externalId, name: '本地资料只读访问',
    description: '已审核接入方式的官方 MCP Filesystem 包，运行于受控本地进程，读取仍需当前资料授权。',
    version, repository: 'https://github.com/modelcontextprotocol/servers', packageName: externalId, transport: 'stdio',
    sourceHash: protocolHash(FILESYSTEM_RECIPE), fetchedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString()};
}

/** Catalogs provide discovery metadata. Verification and execution remain separate stages. */
export function createCapabilitySources(options: {state: AcquisitionState; fetcher: PublicFetch; sanitize: (text: string) => Promise<string>}) {
  async function candidate(source: DiscoverySource, externalId: string, version: string, fields: Partial<CapabilityCandidate>): Promise<CapabilityCandidate> {
    if (!externalId || externalId.length > 512 || !version || version.length > 160) throw Error('invalid_metadata');
    const stable = {source, externalId, version, repository: fields.repository || null, packageName: fields.packageName || null, transport: fields.transport || 'unknown' as const};
    return {...stable, id: 'xicandidate_' + protocolHash({source, externalId, version}),
      name: await options.sanitize(text(fields.name || externalId, 160)), description: await options.sanitize(text(fields.description)),
      sourceHash: protocolHash(stable), fetchedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString()};
  }
  const json = async (url: string, signal: AbortSignal) => JSON.parse((await options.fetcher(url, signal, 4 * 1048576)).toString('utf8')) as unknown;
  async function official(query: string, signal: AbortSignal) {
    const found: CapabilityCandidate[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 3; page++) {
      const url = new URL('https://registry.modelcontextprotocol.io/v0.1/servers');
      url.searchParams.set('search', query); url.searchParams.set('limit', '20'); url.searchParams.set('version', 'latest');
      if (cursor) url.searchParams.set('cursor', cursor);
      const body = await json(url.href, signal);
      if (!object(body) || !Array.isArray(body.servers)) throw Error('invalid_metadata');
      for (const entry of body.servers.slice(0, 20)) {
        if (!object(entry) || !object(entry.server)) continue;
        const server = entry.server;
        const packages = Array.isArray(server.packages) ? server.packages.filter(object) : [];
        const npm = packages.find(pkg => pkg.registryType === 'npm' && typeof pkg.identifier === 'string');
        const repo = object(server.repository) ? repository(server.repository.url) : null;
        try {found.push(await candidate('official_mcp', text(server.name, 512), text(server.version, 160), {
          name: text(server.title || server.name, 160), description: text(server.description), repository: repo,
          packageName: npm ? text(npm.identifier, 214) : null, transport: npm ? 'stdio' : Array.isArray(server.remotes) && server.remotes.length ? 'http' : 'unknown'}));}
        catch { /* Isolate malformed catalog entries. */ }
      }
      const metadata = object(body.metadata) ? body.metadata : {};
      if (typeof metadata.nextCursor !== 'string' || !metadata.nextCursor || metadata.nextCursor.length > 1024 || metadata.nextCursor === cursor) break;
      cursor = metadata.nextCursor;
    }
    return found;
  }
  async function github(query: string, signal: AbortSignal) {
    const url = new URL('https://api.github.com/search/repositories');
    url.searchParams.set('q', query + ' mcp'); url.searchParams.set('per_page', '20'); url.searchParams.set('page', '1');
    const body = await json(url.href, signal);
    if (!object(body) || !Array.isArray(body.items)) throw Error('invalid_metadata');
    const found: CapabilityCandidate[] = [];
    for (const entry of body.items.slice(0, 20)) {
      if (!object(entry) || !repository(entry.html_url)) continue;
      try {found.push(await candidate('github', text(entry.full_name, 512), text(entry.pushed_at || entry.updated_at, 160), {
        name: text(entry.full_name, 160), description: text(entry.description), repository: repository(entry.html_url)}));}
      catch { /* A bad repository cannot make other sources fail. */ }
    }
    return found;
  }
  async function community(query: string, signal: AbortSignal) {
    const commit = await json('https://api.github.com/repos/punkpeye/awesome-mcp-servers/commits/main', signal);
    if (!object(commit) || typeof commit.sha !== 'string' || !/^[a-f0-9]{40}$/u.test(commit.sha)) throw Error('invalid_metadata');
    const bytes = await options.fetcher('https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/' + commit.sha + '/README.md', signal, 4 * 1048576, 'text/plain');
    const terms = query.toLocaleLowerCase().split(/\s+/u);
    const found: CapabilityCandidate[] = [];
    for (const line of bytes.toString('utf8').split('\n')) {
      if (!terms.every(term => line.toLocaleLowerCase().includes(term))) continue;
      const match = line.match(/\[([^\]]{1,160})\]\((https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\)/u);
      if (!match || found.length >= 20) continue;
      found.push(await candidate('community', match[2], commit.sha, {name: match[1], description: text(line.replace(/\[[^\]]+\]\([^)]*\)/gu, match[1])), repository: match[2]}));
    }
    return found;
  }
  return {
    async search(raw: string, sources: DiscoverySource[] = ['reviewed', 'official_mcp', 'github', 'community'], signal: AbortSignal) {
      if (typeof raw !== 'string' || raw.trim().length < 1 || raw.length > 160 || !Array.isArray(sources)
          || !sources.length || sources.length > 4 || new Set(sources).size !== sources.length
          || sources.some(source => !['reviewed', 'official_mcp', 'github', 'community'].includes(source))) throw Error('invalid_input');
      const query = (await options.sanitize(raw)).trim();
      if (!query) throw Error('invalid_input');
      const cached = await options.state.candidates();
      const status: NonNullable<AcquisitionView['sourceStatus']> = [];
      const groups = await Promise.all(sources.map(async source => {
        try {
          let rows: CapabilityCandidate[];
          if (source === 'reviewed') rows = [reviewedFilesystemCandidate()];
          else if (source === 'official_mcp') rows = await official(query, signal);
          else if (source === 'github') rows = await github(query, signal);
          else rows = await community(query, signal);
          await options.state.cache(rows);
          status.push({source, status: 'online'});
          return rows;
        } catch (error) {
          signal.throwIfAborted();
          const rows = cached.filter(row => row.source === source && (row.name + ' ' + row.description + ' ' + row.packageName).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
          status.push({source, status: rows.length ? 'cached' : 'unavailable', error: error instanceof Error && error.message === 'rate_limited' ? 'rate_limited' : 'source_unavailable'});
          return rows;
        }
      }));
      return {candidates: groups.flat(), sourceStatus: status};
    },
  };
}
