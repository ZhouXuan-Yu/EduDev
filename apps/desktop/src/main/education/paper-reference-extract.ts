import {createHash} from 'node:crypto';
import {PAPER_REFERENCE_SCHEMA, PAPER_REFERENCE_PARSER, referenceLayoutKeys, unknownReferenceField,
  type PaperReferenceCandidate, type ReferenceEvidence, type ReferenceField, type ReferenceSection} from '../../shared/paper-reference';
import {materialSource, type MaterialReadingUnit} from '../assets/material-source';

export const referenceHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type ReferenceBody = {units: MaterialReadingUnit[]; complete: boolean; totalChunks: number; parseEngine: string; bodyDigest: string};
export function extractReferenceStructure(body: ReferenceBody): PaperReferenceCandidate {
  const evidence: ReferenceEvidence[] = [], warnings: string[] = [];
  const unknown = unknownReferenceField;
  const result: PaperReferenceCandidate = {schemaVersion: PAPER_REFERENCE_SCHEMA, parser: PAPER_REFERENCE_PARSER,
    source: {resourceId: body.units[0].resourceId, version: body.units[0].version, bodyDigest: body.bodyDigest,
      parseEngine: body.parseEngine, readChunks: body.units.length, totalChunks: body.totalChunks, complete: body.complete,
      units: body.units.map(materialSource)}, digest: '', title: unknown(), subject: unknown(), grade: unknown(),
    durationMinutes: unknown(), totalPoints: unknown(), sections: [],
    layout: Object.fromEntries(referenceLayoutKeys.map(key => [key, unknown()])) as PaperReferenceCandidate['layout'], evidence, warnings};
  if (!body.complete) warnings.push('仅读取部分已收录正文，不能据此确认整卷结构。');
  // Bounded contextual excerpts also make unknown fields inspectable; not a second full-text store.
  for (const unit of body.units.slice(0, 3)) evidence.push({id: 'context_' + evidence.length,
    text: unit.chunk.contentMd.slice(0, 800), source: materialSource(unit), line: 1});
  function field(value: string | undefined, id: string, unsupported = false): ReferenceField {
    return value === undefined ? unknown() : {value, status: unsupported ? 'unsupported' : 'known', evidenceIds: [id], confirmed: false};
  }
  function merge(key: 'title' | 'subject' | 'grade' | 'durationMinutes' | 'totalPoints', next: ReferenceField) {
    const prior = result[key];
    result[key] = prior.value === null ? next : {...prior, status: prior.value === next.value ? prior.status : 'ambiguous', evidenceIds: [...prior.evidenceIds, ...next.evidenceIds]};
  }
  let lines = 0;
  for (const unit of body.units) {
    const content = unit.chunk.contentMd.split(/\r?\n/);
    for (let index = 0; index < content.length; index++) {
      if (++lines > 20000 || evidence.length >= 200) {warnings.push('结构定位达到读取上限，后续字段尚未提取。'); return finish();}
      const text = content[index].trim(); if (!text) continue;
      const section = /^(?:#{1,6}\s*)?(?:[一二三四五六七八九十]+[、.．]|第[一二三四五六七八九十0-9]+部分)\s*(.+)$/.exec(text);
      const meta = /^(?:#{1,6}\s*)?(试卷名称|标题|学科|年级|时长|考试时间|总分|满分)\s*[:：]\s*(.+)$/.exec(text);
      if (!section && !meta) continue;
      const id = 'body_' + evidence.length;
      evidence.push({id, text: text.slice(0, 800), source: materialSource(unit), line: index + 1});
      if (text.length > 800) {warnings.push('过长字段保留部分依据，需人工核对。'); continue;}
      if (meta) {
        const names = {试卷名称: 'title', 标题: 'title', 学科: 'subject', 年级: 'grade', 时长: 'durationMinutes', 考试时间: 'durationMinutes', 总分: 'totalPoints', 满分: 'totalPoints'} as const;
        const key = names[meta[1] as keyof typeof names];
        let value = meta[2].trim(), invalid = false;
        if (key === 'durationMinutes' || key === 'totalPoints') {
          const numeric = /^(\d+(?:\.\d+)?)\s*(?:分钟|分)?$/.exec(value);
          if (numeric) {value = numeric[1]; invalid = !/^\d+$/.test(value) || Number(value) <= 0;}
          else invalid = true;
        }
        merge(key, field(value, id, invalid));
      }
      if (section && result.sections.length < 20) {
        const label = section[1], type = /(单项选择题|多项选择题|选择题|填空题|解答题|判断题|简答题|计算题|证明题|实验题)/.exec(label)?.[1];
        const count = /(?:共|本大题共)\s*(\d+(?:\.\d+)?)\s*(?:小题|道题|题)/.exec(label)?.[1];
        const points = /每(?:小题|题)\s*(\d+(?:\.\d+)?)\s*分/.exec(label)?.[1];
        const irregular = /选做|任选|不等分|分别|各题/.test(label);
        const sectionValue: ReferenceSection = {id: 'reference_section_' + result.sections.length,
          label: field(label, id), questionType: field(type, id),
          count: field(count, id, irregular || !!count && (!/^\d+$/.test(count) || Number(count) < 1)),
          points: field(points, id, irregular || !!points && (!/^\d+$/.test(points) || Number(points) < 1)), difficulty: unknown(), knowledgePoint: unknown()};
        if (irregular) warnings.push('存在选做或不等分说明，请逐节核对，不能直接转换为同节等分蓝图。');
        result.sections.push(sectionValue);
      } else if (section) warnings.push('分节超过20节，未完整提取。');
    }
  }
  return finish();
  function finish() {result.digest = referenceHash(result); return result;}
}
