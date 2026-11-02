import {readWordPackage, wordTarget} from '../assets/word-package';
import {readWordXml, children, descendants, WORD_NS, PACKAGE_NS} from '../assets/word-xml';
import {referenceHash} from './paper-reference-extract';
import type {PaperReferenceCandidate, ReferenceLayoutKey, ReferenceField} from '../../shared/paper-reference';

/** Reads actual package settings only. No file names, external relationships, implicit Word defaults or rendering. */
export async function extractReferenceWordLayout(bytes: Uint8Array, candidate: PaperReferenceCandidate, signal: AbortSignal) {
  signal.throwIfAborted(); const parts = await readWordPackage(bytes); signal.throwIfAborted();
  const relations = parts.get('_rels/.rels'); let main = 'word/document.xml'; const budget = {nodes: 0};
  if (relations) {
    const root = readWordXml(relations, budget).root;
    if (root.uri !== PACKAGE_NS || root.name !== 'Relationships') throw Error('parse_failed');
    const offices = children(root, 'Relationship').filter(n => n.attrs.Type?.endsWith('/officeDocument'));
    if (offices.length !== 1 || offices[0].attrs.TargetMode === 'External') throw Error('parse_failed');
    main = wordTarget('', offices[0].attrs.Target);
  }
  const xml = parts.get(main); if (!xml) throw Error('parse_failed');
  const parsed = readWordXml(xml, budget), root = parsed.root;
  if (!WORD_NS.has(root.uri) || root.name !== 'document') throw Error('parse_failed');
  // Ignore tracked historical sectPrChange and nested copies: only live body/paragraph section properties apply.
  const settings = descendants(root, 'sectPr', WORD_NS).filter(n => /^\/document\[\d+\]\/body\[\d+\]\/(?:p\[\d+\]\/pPr\[\d+\]\/)?sectPr\[\d+\]$/.test(n.path));
  candidate.source.structureDigest = referenceHash({part: main, xml: xml.toString('base64')});
  if (settings.length > 32) throw Error('too_large');
  const values = new Map<ReferenceLayoutKey, ReferenceField[]>();
  for (const section of settings) {
    signal.throwIfAborted();
    const get = (name: string) => {const matches = children(section, name); if (matches.length > 1) throw Error('parse_failed'); return matches[0];};
    const size = get('pgSz'), margins = get('pgMar'), columns = get('cols');
    if (Number(margins?.attrs.gutter || 0) !== 0) candidate.warnings.push('原卷含装订线边距；此属性未转换为普通边距，请对照原卷核对。');
    const id = 'word_' + candidate.evidence.length;
    candidate.evidence.push({id, part: main, path: section.path, text: parsed.xml.slice(section.start, section.end).slice(0, 800)});
    const add = (key: ReferenceLayoutKey, value?: string, unsupported = false) => {
      if (value !== undefined && value.length > 160) throw Error('too_large');
      const f: ReferenceField = value === undefined ? {value: null, status: 'unknown', evidenceIds: [id], confirmed: false}
        : {value, status: unsupported ? 'unsupported' : 'known', evidenceIds: [id], confirmed: false};
      values.set(key, [...values.get(key) || [], f]);
    };
    const w = Number(size?.attrs.w), h = Number(size?.attrs.h);
    const numeric = (value?: string) => value !== undefined && /^\d+$/.test(value) && Number(value) <= 31680;
    const a4 = numeric(size?.attrs.w) && numeric(size?.attrs.h) && Math.abs(Math.min(w, h) - 11906) <= 4 && Math.abs(Math.max(w, h) - 16838) <= 4;
    add('paper', size ? a4 ? 'A4' : `${size.attrs.w || '?'}×${size.attrs.h || '?'} twip` : undefined, !!size && !a4);
    add('orientation', numeric(size?.attrs.w) && numeric(size?.attrs.h) ? w > h ? 'landscape' : 'portrait' : undefined);
    for (const key of ['top', 'right', 'bottom', 'left'] as const) add(key, margins?.attrs[key], margins?.attrs[key] !== undefined && !numeric(margins.attrs[key]));
    const num = columns?.attrs.num;
    const unequal = !!columns && (columns.attrs.equalWidth === '0' || columns.attrs.equalWidth === 'false' || children(columns, 'col').length > 0);
    add('columns', num, !!num && (!['1', '2'].includes(num) || unequal));
    add('columnGap', columns?.attrs.space, columns?.attrs.space !== undefined && !numeric(columns.attrs.space));
  }
  for (const [key, fields] of values) {
    const first = fields[0], different = fields.some(f => f.value !== first.value || f.status !== first.status);
    candidate.layout[key] = {...first, status: different ? 'ambiguous' : first.status, evidenceIds: fields.flatMap(f => f.evidenceIds)};
  }
  if (settings.length > 1) candidate.warnings.push('原卷包含多个节；不同页面规则标为歧义，须明确统一设置。');
  if (!settings.length) candidate.warnings.push('原文件未显式记录可读取的页面设置，不能视作已识别A4。');
  signal.throwIfAborted();
}
