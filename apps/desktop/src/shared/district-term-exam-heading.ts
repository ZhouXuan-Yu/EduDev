import {MOCK_EXAM_GRADES, MOCK_EXAM_SUBJECTS, SHANGHAI_DISTRICTS, mockExamYear} from './mock-exam-compilation';

const districts = SHANGHAI_DISTRICTS.join('|');
const gradeAliases = ['初预', '初一', '初二', '初三'];
const grade = `(?<grade>${[...MOCK_EXAM_GRADES, ...gradeAliases].join('|')})(?:年级)?`;
const subject = `(?<subject>${MOCK_EXAM_SUBJECTS.join('|')})`;
const event = '(?<event>期[末终](?:质量监控|质量检测|质量调研|调研测试|统一测试))';
const term = '(?<year>\\d{4})(?:[-–—至](?<endYear>\\d{4}))?学年(?:度)?第(?<term>[一二12])学期';
const region = `(?:上海(?:市)?)?(?<district>${districts})`;
const front = `(?:${region}${term})`;
const paper = '(?<paper>试卷|试题)?';
const lastRole = '(?<role>试卷|试题|参考答案(?:及解析)?|答案(?:册|解析)?|评分标准)?';
const edition = (name: string) => `(?:(?<${name}>[ABCD甲乙丙丁]卷)|\\((?<${name}Paren>[ABCD甲乙丙丁]卷)\\))?`;
const middleEdition = edition('middle'), finalEdition = edition('final');
const patterns = [
  new RegExp(`^${front}${event}${paper}${middleEdition}${grade}${subject}${lastRole}${finalEdition}$`, 'u'),
  new RegExp(`^${front}${grade}${event}${paper}${middleEdition}${subject}${lastRole}${finalEdition}$`, 'u'),
];

// Recognize an incomplete cover as a boundary as well, including out-of-region
// headings. Otherwise a later numbered answer could inherit the preceding exam.
const termHeadingStart = /^[\p{Script=Han}]{2,20}(?:区|县|市)\d{4}(?:[-–—至]\d{4})?学年(?:度)?(?:第[一二12]学期)?/u;

export function startsDistrictTermExamHeading(normalized: string): boolean {
  return normalized.length <= 100 && termHeadingStart.test(normalized);
}

export function districtTermExamIdentity(normalized: string): string | undefined {
  if (!startsDistrictTermExamHeading(normalized)) return;
  for (const pattern of patterns) {
    const fields = pattern.exec(normalized)?.groups;
    if (!fields) continue;
    const {district, year, endYear, term, event, grade, subject, paper, role, middle, middleParen, final, finalParen} = fields;
    const versions = [middle, middleParen, final, finalParen].filter(Boolean);
    if (!mockExamYear(Number(year)) || endYear && (!mockExamYear(Number(endYear)) || Number(endYear) !== Number(year) + 1) ||
        !paper && !role || versions.length > 1) return;
    const gradeName = MOCK_EXAM_GRADES[gradeAliases.indexOf(grade)] ?? grade;
    const termNumber = term === '一' || term === '1' ? 1 : 2;
    return [district, year, termNumber, event, gradeName, subject, versions[0] ?? ''].join('|');
  }
}
