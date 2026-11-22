import type {Sql} from '../xiaozhi-agent/session-state';
import {TEACHER_GRADES, TEACHER_SUBJECTS, type TeacherMemoryPolicy, type TeacherMemorySettingsInput, type TeacherProfile} from '../../shared/teacher-memory-settings';
import {TEACHER_PREFERENCE_VALUES, type TeacherPreferenceValues} from '../../shared/teacher-preferences';

export const TEACHER_MEMORY_POLICY_KEY = 'xiaozhi.teacher-preference.v1:personal-policy';
export const emptyTeacherMemoryPolicy = (): TeacherMemoryPolicy => ({
  revision: 0, profile: { subject: '', grade: '', textbook: '' }, use: {}, updatedAt: null,
});
const modes = ['relevant', 'profile', 'off'];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isRevision = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const hasOnly = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));

export function parseTeacherMemorySettings(input: unknown): TeacherMemorySettingsInput {
  if (!isRecord(input) || !hasOnly(input, ['revision', 'preferenceRevision', 'profile', 'use']) ||
      !isRevision(input.revision) || !isRevision(input.preferenceRevision) ||
      !isRecord(input.profile) || !hasOnly(input.profile, ['subject', 'grade', 'textbook']) || !isRecord(input.use)) {
    throw Error('invalid_input');
  }
  const {subject, grade, textbook} = input.profile;
  if (!(subject === '' || TEACHER_SUBJECTS.some(value => value === subject)) ||
      !(grade === '' || TEACHER_GRADES.some(value => value === grade)) ||
      typeof textbook !== 'string' || textbook.length > 60 || /[\p{Cc}\p{Cf}]/u.test(textbook)) {
    throw Error('invalid_input');
  }
  const use: TeacherMemoryPolicy['use'] = {};
  for (const [key, mode] of Object.entries(input.use)) {
    if (!Object.hasOwn(TEACHER_PREFERENCE_VALUES, key) || typeof mode !== 'string' || !modes.includes(mode)) {
      throw Error('invalid_input');
    }
    if (mode !== 'relevant') use[key as keyof TeacherPreferenceValues] = mode as 'profile' | 'off';
  }
  if (Object.values(use).includes('profile') && (!subject || !grade)) throw Error('invalid_input');
  return { revision: input.revision, preferenceRevision: input.preferenceRevision,
    profile: { subject, grade, textbook: textbook.trim() } as TeacherProfile, use };
}

export async function readTeacherMemoryPolicy(sql: Sql): Promise<TeacherMemoryPolicy> {
  const [row] = await sql.all('SELECT value_json,updated_at FROM app_settings WHERE key=?', [TEACHER_MEMORY_POLICY_KEY]);
  if (!row) return emptyTeacherMemoryPolicy();
  try {
    const raw = String(row.value_json);
    if (raw.length > 4096) throw Error('configuration');
    const stored = JSON.parse(raw);
    if (stored.schemaVersion !== 1 || !hasOnly(stored, ['schemaVersion', 'revision', 'profile', 'use']) ||
        !stored.revision || typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at))) {
      throw Error('configuration');
    }
    const {revision, profile, use} = parseTeacherMemorySettings({
      revision: stored.revision, preferenceRevision: 0, profile: stored.profile, use: stored.use,
    });
    return { revision, profile, use, updatedAt: row.updated_at };
  } catch {
    throw Error('configuration');
  }
}

const gradeAliases: Record<string, string> = {
  初一: '七年级', 初二: '八年级', 初三: '九年级',
  小一: '一年级', 小二: '二年级', 小三: '三年级', 小四: '四年级', 小五: '五年级', 小六: '六年级',
  高中一年级: '高一', 高中二年级: '高二', 高中三年级: '高三',
  高一下: '高一', 高二下: '高二', 高三下: '高三', 高一上: '高一', 高二上: '高二', 高三上: '高三',
  ...Object.fromEntries(TEACHER_GRADES.slice(0, 9).map((name, index) => [`${index + 1}年级`, name])),
};
const grades = new RegExp([...Object.keys(gradeAliases), ...TEACHER_GRADES].sort((a,b) => b.length - a.length).join('|'), 'gu');
const subjects = new RegExp(TEACHER_SUBJECTS.join('|'), 'gu');
const uncertain = /(?:不(?:是|用|按|面向)|不要|排除|跳过|切换|而非|除外).{0,10}(?:年级|初[一二三]|高[一二三]|数学|物理|语文|英语|化学|生物|历史|地理|政治|科学|信息技术|音乐|美术|体育)/u;

function matchesProfile(profile: TeacherProfile, request: string, course?: string): boolean {
  if (!profile.subject || !profile.grade) return false;
  const text = [course, request].filter(Boolean).join('\n').normalize('NFKC');
  if (uncertain.test(text)) return false;
  const foundSubjects = new Set(text.match(subjects));
  const foundGrades = new Set((text.match(grades) || []).map(grade => gradeAliases[grade] || grade));
  return foundSubjects.size === 1 && foundSubjects.has(profile.subject) &&
    foundGrades.size === 1 && foundGrades.has(profile.grade);
}

export function teacherMemoryValues(values: TeacherPreferenceValues, policy: TeacherMemoryPolicy | null,
  request: string, course?: string): TeacherPreferenceValues {
  if (!policy) return {};
  const matches = Object.values(policy.use).includes('profile') && matchesProfile(policy.profile, request, course);
  return Object.fromEntries(Object.entries(values).filter(([key]) => {
    const mode = policy.use[key as keyof TeacherPreferenceValues] || 'relevant';
    return mode === 'relevant' || mode === 'profile' && matches;
  }));
}
