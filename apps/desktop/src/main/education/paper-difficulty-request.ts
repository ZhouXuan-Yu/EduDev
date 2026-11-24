import type {PaperBlueprint} from '../../shared/paper-blueprint';
import {PAPER_DIFFICULTIES, paperPlannedDifficulty} from '../../shared/paper-section-fit';

const names = ['(?:易|简单|基础)题?', '(?:中等|中)题?', '(?:困难|难)题?'];
const heading = '难度(?:比例|分布|配比|占比)';
const tiers = names.join(String.raw`\s*[:/、]?\s*`);
const decimal = String.raw`(\d{1,3}(?:\.\d{1,2})?)`;
const weight = decimal + String.raw`\s*(%)?`;
const whole = String.raw`(?:全卷|整卷)?\s*`;
const connector = String.raw`\s*(?:按|分别为|均为|设为|为|是|[:=])?\s*`;
const grouped = new RegExp(String.raw`^${whole}(?:${heading}\s*[:=]?\s*(?:${tiers})?|${tiers}\s*(?:${heading}|比例|配比)?)${connector}${weight}\s*[:/]\s*${weight}\s*[:/]\s*${weight}$`, 'u');
const single = names.map(name => new RegExp(String.raw`^${whole}${name}\s*(?:占比|占)\s*(?:为|[:=])?\s*${decimal}\s*%$`, 'u'));

const tolerance = 0.05;
const epsilon = 1e-7;
const percentageRounding = 0.0002;
export type PaperDifficultyMismatch = 'difficulty' | 'difficulty_impossible' | 'ambiguous';

export function isPaperDifficultyClause(clause: string): boolean {
  return grouped.test(clause) || single.some(rule => rule.test(clause));
}

export function comparePaperDifficulty(clauses: readonly string[], blueprint: PaperBlueprint, count: number): PaperDifficultyMismatch | undefined {
  const targets = new Map<number, number>();
  const record = (index: number, fraction: number) => {
    const previous = targets.get(index);
    if (fraction > 1 || previous !== undefined && Math.abs(previous - fraction) > percentageRounding) return false;
    targets.set(index, previous ?? fraction);
    return true;
  };
  for (const clause of clauses) {
    const match = grouped.exec(clause);
    if (match) {
      const weights = [Number(match[1]), Number(match[3]), Number(match[5])];
      const total = weights.reduce((sum, value) => sum + value, 0);
      const percentages = [match[2], match[4], match[6]].filter(Boolean).length;
      if (!total || percentages && (percentages !== 3 || Math.abs(total / 100 - 1) > percentageRounding)) return 'ambiguous';
      if (!weights.every((value, index) => record(index, value / (percentages ? 100 : total)))) return 'ambiguous';
      continue;
    }
    for (const [index, rule] of single.entries()) {
      const named = rule.exec(clause);
      if (named && !record(index, Number(named[1]) / 100)) return 'ambiguous';
    }
  }
  if (!targets.size) return;
  const total = [...targets.values()].reduce((sum, value) => sum + value, 0);
  if (total > 1 + percentageRounding || targets.size === 3 && total < 1 - percentageRounding) return 'ambiguous';

  const ranges = PAPER_DIFFICULTIES.map((_, index) => {
    const fraction = targets.get(index);
    if (fraction === undefined) return [0, count];
    if (fraction === 0 || fraction === 1) return [fraction * count, fraction * count];
    return [Math.max(0, Math.ceil((fraction - tolerance) * count - epsilon)),
      Math.min(count, Math.floor((fraction + tolerance) * count + epsilon))];
  });
  const min = ranges.reduce((sum, [lower]) => sum + lower, 0);
  const max = ranges.reduce((sum, [, upper]) => sum + upper, 0);
  if (min > count || max < count || ranges.some(([lower, upper]) => lower > upper)) return 'difficulty_impossible';
  const planned = paperPlannedDifficulty(blueprint);
  if (planned.unspecified || PAPER_DIFFICULTIES.some((level, index) => {
    const [lower, upper] = ranges[index];
    return planned[level] < lower || planned[level] > upper;
  })) return 'difficulty';
}
