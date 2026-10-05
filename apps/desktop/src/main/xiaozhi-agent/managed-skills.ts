import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { loadSkillsFromDir, parseFrontmatter } from '@earendil-works/pi-coding-agent';
import { EDUCATION_SKILLS, EDUCATION_SKILL_VERSION, skillDocument } from './education-skills';
import { LEGACY_EDUCATION_SKILLS, legacySkillDocument } from './education-skills-legacy-v1';
import { assertInstallTargetInsideRoot, sanitizeSkillName } from './vendor/hana/lib/skills/skill-package-installer';
import { SKILL_LIMITS, validSkillName, validSkillRelative, type PrivateManagedSkill, type PrivateSkillCatalog,
  type SkillPackageFile, type createPiSkillCatalogState } from './skill-catalog-state';

type State = ReturnType<typeof createPiSkillCatalogState>;
type PackageBytes = Map<string, Buffer>;
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const canonical = (value: string) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
const samePath = (a: string, b: string) => canonical(a) === canonical(b);
const utf8 = (bytes: Buffer) => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('invalid_input'); }
};
/** Validate the named path and its ancestors; never discover neighbouring resources. */
export function noLinks(target: string, allowMissing = false) {
  const absolute = path.resolve(target), anchor = path.parse(absolute).root;
  if (!path.isAbsolute(target) || !anchor || target.includes('\0')) throw new Error('invalid_input');
  let current = anchor;
  for (const part of absolute.slice(anchor.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) {
      // existsSync follows broken links; lstat must reject those too.
      try { fs.lstatSync(current); throw new Error('skill_source_changed'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (!allowMissing) throw new Error('skill_source_changed');
      continue;
    }
    if (fs.lstatSync(current).isSymbolicLink() || !samePath(fs.realpathSync(current), current)) throw new Error('skill_source_changed');
  }
}
export function boundedRead(file: string, limit: number) {
  noLinks(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.size > limit) throw new Error('invalid_input');
    const buffer = Buffer.alloc(Math.min(limit, before.size) + 1);
    let count = 0, size = 0;
    do { size = fs.readSync(fd, buffer, count, buffer.length - count, count); count += size; } while (size && count < buffer.length);
    const after = fs.fstatSync(fd);
    noLinks(file);
    if (count > limit || count !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs
      || after.ino !== before.ino || after.dev !== before.dev) throw new Error('skill_source_changed');
    return buffer.subarray(0, count);
  } finally { fs.closeSync(fd); }
}
export function readPackage(directory: string): PackageBytes {
  noLinks(directory);
  if (!fs.statSync(directory).isDirectory()) throw new Error('invalid_input');
  const bytes: PackageBytes = new Map();
  let nodes = 0, total = 0;
  const visit = (dir: string, prefix: string, depth: number) => {
    if (depth > SKILL_LIMITS.depth) throw new Error('invalid_input');
    noLinks(dir);
    const iterator = fs.opendirSync(dir), seen = new Set<string>();
    try {
      let entry: fs.Dirent | null;
      while ((entry = iterator.readSync())) {
        if (++nodes > SKILL_LIMITS.nodes) throw new Error('invalid_input');
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!validSkillRelative(relative) || seen.has(entry.name.toLowerCase())) throw new Error('invalid_input');
        seen.add(entry.name.toLowerCase());
        const file = path.join(dir, entry.name), stat = fs.lstatSync(file);
        if (stat.isSymbolicLink()) throw new Error('skill_source_changed');
        if (stat.isDirectory()) visit(file, relative, depth + 1);
        else if (stat.isFile()) {
          if (bytes.size >= SKILL_LIMITS.files) throw new Error('invalid_input');
          const content = boundedRead(file, relative === 'SKILL.md' ? SKILL_LIMITS.instructionBytes : SKILL_LIMITS.fileBytes);
          if ((total += content.length) > SKILL_LIMITS.bytes) throw new Error('invalid_input');
          bytes.set(relative, content);
        } else throw new Error('invalid_input');
      }
    } finally { iterator.closeSync(); }
    noLinks(dir);
  };
  visit(directory, '', 0);
  if (!bytes.get('SKILL.md')?.length) throw new Error('invalid_input');
  return bytes;
}
const filesOf = (bytes: PackageBytes): SkillPackageFile[] => [...bytes].sort(([a], [b]) => a.localeCompare(b))
  .map(([relative, value]) => ({ relative, size: value.length, sha256: sha(value) }));
function metadata(bytes: PackageBytes) {
  const document = utf8(bytes.get('SKILL.md')!);
  const parsed = parseFrontmatter<{ name?: unknown; description?: unknown }>(document);
  const name = parsed.frontmatter.name, description = parsed.frontmatter.description;
  if (!validSkillName(name) || sanitizeSkillName(name) !== name || typeof description !== 'string' || !description.trim()
    || description.length > 1024 || !parsed.body.trim()) throw new Error('invalid_input');
  const title = parsed.body.match(/^#\s+([^\r\n]+)/m)?.[1]?.trim() || name;
  if (title.length > 120 || title.includes('\0') || description.includes('\0')) throw new Error('invalid_input');
  return { name, title, description, document };
}
/** Main-only foundation. Production IPC must supply its global idle/mutation lock before use. */
export function createManagedEducationSkills(options: { root: string; state: State; assertIdle: () => void }) {
  if (!path.isAbsolute(options.root)) throw new Error('configuration');
  noLinks(options.root, true);
  fs.mkdirSync(options.root, { recursive: true });
  noLinks(options.root);
  const root = fs.realpathSync(options.root), { state } = options;
  async function readCatalog() {
    const catalog = await state.skillCatalog();
    if (!catalog.revision) return catalog;
    // Metadata cannot relabel a teacher package as an application-reviewed Skill.
    const builtins = catalog.skills.filter(item => item.origin === 'builtin');
    if (builtins.length !== EDUCATION_SKILLS.length) throw new Error('configuration');
    for (const currentDefinition of EDUCATION_SKILLS) {
      const item = builtins.find(skill => skill.name === currentDefinition.name);
      const definition = item?.version === 1 ? LEGACY_EDUCATION_SKILLS.find(skill => skill.name === item.name)
        : item?.version === EDUCATION_SKILL_VERSION ? currentDefinition : undefined;
      if (!item || !definition) throw new Error('configuration');
      const document = item.version === 1 ? legacySkillDocument(definition) : skillDocument(definition);
      const expectedFiles = filesOf(new Map([['SKILL.md', Buffer.from(document)]]));
      if (item.title !== definition.title || item.description !== definition.description
        || item.archived || JSON.stringify(item.files) !== JSON.stringify(expectedFiles)) throw new Error('configuration');
    }
    if (catalog.skills.some(item => item.origin === 'teacher' && EDUCATION_SKILLS.some(builtin => builtin.name === item.name))) throw new Error('configuration');
    return catalog;
  }
  function resolveDirectory(item: PrivateManagedSkill) {
    const directory = path.join(root, item.directory);
    assertInstallTargetInsideRoot(directory, root);
    noLinks(directory);
    return directory;
  }
  function verify(item: PrivateManagedSkill) {
    const directory = resolveDirectory(item), bytes = readPackage(directory);
    if (JSON.stringify(filesOf(bytes)) !== JSON.stringify(item.files)) throw new Error('skill_source_changed');
    const meta = metadata(bytes);
    if (meta.name !== item.name || meta.description !== item.description || meta.title !== item.title) throw new Error('skill_source_changed');
    const loaded = loadSkillsFromDir({ dir: directory, source: item.origin === 'builtin' ? 'builtin' : 'path' });
    if (loaded.diagnostics.length || loaded.skills.length !== 1 || loaded.skills[0].name !== item.name) throw new Error('invalid_input');
    // Native loader reads the same files only after the bounded package check.
    if (JSON.stringify(filesOf(readPackage(directory))) !== JSON.stringify(item.files)) throw new Error('skill_source_changed');
    return { bytes, loaded, document: meta.document };
  }
  function writeVersion(bytes: PackageBytes, origin: PrivateManagedSkill['origin'], version: number): PrivateManagedSkill {
    const meta = metadata(bytes), id = randomUUID(), relative = `versions/${meta.name}/${id}/${meta.name}`;
    const directory = path.join(root, relative);
    assertInstallTargetInsideRoot(directory, root);
    noLinks(directory, true);
    // Never overwrite a version. Unreferenced versions remain inert on interrupted/CAS-lost publication.
    fs.mkdirSync(path.dirname(directory), { recursive: true });
    fs.mkdirSync(directory);
    for (const [name, content] of bytes) {
      const file = path.join(directory, name);
      assertInstallTargetInsideRoot(file, directory);
      noLinks(path.dirname(file), true);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      noLinks(path.dirname(file));
      fs.writeFileSync(file, content, { flag: 'wx' });
    }
    const item: PrivateManagedSkill = { name: meta.name, title: meta.title, description: meta.description, origin, version,
      directory: relative, enabled: origin === 'builtin', archived: false, files: filesOf(bytes) };
    verify(item);
    return item;
  }
  let mutating = false;
  async function mutate<T>(operation: () => Promise<T>) {
    options.assertIdle();
    if (mutating) throw new Error('busy');
    mutating = true;
    try { return await operation(); } finally { mutating = false; }
  }
  async function expected(revision: number) {
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('invalid_input');
    const catalog = await readCatalog();
    if (catalog.revision !== revision) throw new Error('stale_version');
    return catalog;
  }
  async function commit(catalog: PrivateSkillCatalog) {
    options.assertIdle();
    if (!await state.saveSkillCatalog(catalog.revision, catalog.skills)) throw new Error('stale_version');
    return { revision: catalog.revision + 1, skills: structuredClone(catalog.skills) };
  }
  return {
    initialize() { return mutate(async () => {
      await state.migrateSkillCatalog();
      // On CAS loss reread the winner, preserving its enable choices and teacher packages.
      // Interrupted/unpublished immutable directories remain inert; never rewrite old files.
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await readCatalog();
        const outdated = current.skills.filter(item => item.origin === 'builtin' && item.version !== EDUCATION_SKILL_VERSION);
        if (current.revision && !outdated.length) return current;
        outdated.forEach(verify);
        options.assertIdle();
        const fresh = () => EDUCATION_SKILLS.map(item => writeVersion(new Map([['SKILL.md', Buffer.from(skillDocument(item))]]), 'builtin', EDUCATION_SKILL_VERSION));
        const skills = !current.revision ? fresh() : current.skills.map(item => {
          if (item.origin !== 'builtin' || item.version === EDUCATION_SKILL_VERSION) return item;
          const definition = EDUCATION_SKILLS.find(skill => skill.name === item.name)!;
          return { ...writeVersion(new Map([['SKILL.md', Buffer.from(skillDocument(definition))]]), 'builtin', EDUCATION_SKILL_VERSION), enabled: item.enabled };
        });
        outdated.forEach(verify); // A source changed during capture cannot publish a silently repaired catalog.
        options.assertIdle();
        if (await state.saveSkillCatalog(current.revision, skills)) return { revision: current.revision + 1, skills };
      }
      throw new Error('stale_version');
    }); },
    catalog: readCatalog,
    async preview(name: string) {
      if (!validSkillName(name)) throw new Error('invalid_input');
      const catalog = await readCatalog(), item = catalog.skills.find(skill => skill.name === name);
      if (!item || item.archived) throw new Error('invalid_input');
      const { document } = verify(item);
      return { revision: catalog.revision, name, version: item.version, document };
    },
    importDirectory(source: string, revision: number) {
      return mutate(async () => {
        if (!path.isAbsolute(source) || source.length > 4096) throw new Error('invalid_input');
        const catalog = await expected(revision), bytes = readPackage(source), meta = metadata(bytes);
        const existing = catalog.skills.find(item => item.name === meta.name);
        if (existing && (!existing.archived || existing.origin === 'builtin')) throw new Error('skill_exists');
        if (!existing && catalog.skills.length >= SKILL_LIMITS.skills) throw new Error('invalid_input');
        const item = writeVersion(bytes, 'teacher', (existing?.version || 0) + 1);
        // Source changes during capture/import cannot silently become a different package.
        if (JSON.stringify(filesOf(readPackage(source))) !== JSON.stringify(filesOf(bytes))) throw new Error('skill_source_changed');
        catalog.skills = existing ? catalog.skills.map(old => old.name === item.name ? item : old) : [...catalog.skills, item];
        return commit(catalog);
      });
    },
    setEnabled(name: string, revision: number, enabled: boolean) {
      return mutate(async () => {
        if (!validSkillName(name) || typeof enabled !== 'boolean') throw new Error('invalid_input');
        const catalog = await expected(revision), item = catalog.skills.find(skill => skill.name === name && !skill.archived);
        if (!item) throw new Error('invalid_input');
        if (enabled) verify(item); // Turning off a corrupt source remains possible.
        item.enabled = enabled;
        return commit(catalog);
      });
    },
    edit(name: string, revision: number, document: string) {
      return mutate(async () => {
        if (!validSkillName(name) || typeof document !== 'string' || Buffer.byteLength(document) > SKILL_LIMITS.instructionBytes) throw new Error('invalid_input');
        const catalog = await expected(revision), item = catalog.skills.find(skill => skill.name === name && !skill.archived);
        if (!item || item.origin === 'builtin') throw new Error('permission_denied');
        const { bytes } = verify(item);
        bytes.set('SKILL.md', Buffer.from(document));
        if (metadata(bytes).name !== item.name) throw new Error('invalid_input');
        const next = writeVersion(bytes, 'teacher', item.version + 1);
        // New instructions require an explicit enable action; no silent grant carry-over.
        catalog.skills = catalog.skills.map(old => old.name === name ? next : old);
        return commit(catalog);
      });
    },
    archive(name: string, revision: number) {
      return mutate(async () => {
        if (!validSkillName(name)) throw new Error('invalid_input');
        const catalog = await expected(revision), item = catalog.skills.find(skill => skill.name === name && !skill.archived);
        if (!item || item.origin === 'builtin') throw new Error('permission_denied');
        item.enabled = false; item.archived = true;
        return commit(catalog);
      });
    },
    /** Main-only runtime descriptors; UI never receives local source paths. */
    async enabledResources() {
      const catalog = await readCatalog();
      const resources = catalog.skills.filter(item => item.enabled && !item.archived).map(item => {
        const { loaded, bytes } = verify(item);
        return { item: structuredClone(item), directory: resolveDirectory(item), skill: loaded.skills[0], bytes };
      });
      return { revision: catalog.revision, resources };
    },
  };
}
