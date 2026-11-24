import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
const {inferMockExam,mockExamCoverHeader}=await import('../../src/main/education/mock-exam-metadata.ts');
const {mockExamCoverLabel}=await import('../../src/shared/mock-exam-compilation.ts');

const file='上海杨浦区2025届高三一模数学试卷.pdf';
const heading='杨浦区2024学年度第一学期高三年级模拟质量调研\n数学试卷2024.12';
const raw=heading+'\n一、填空题\n1. 徐汇区2026年英语题目';
const cover=mockExamCoverHeader(raw);
assert.equal(cover,heading);

const result=inferMockExam(file,'徐汇区2026年英语', {year:2025},cover);
assert.deepEqual(result.metadata,{district:'杨浦区',year:null,subject:'数学',grade:'高三',round:'一模'});
assert.deepEqual(result.conflicts,['year']);
assert.deepEqual(result.cover,{page:1,academicYear:2024,examMonth:{year:2024,month:12},filenameCohort:2025});
assert.match(mockExamCoverLabel(result.cover),/封面学年度 2024.*封面考试月份 2024 年 12 月.*文件名 2025 届/u);

assert.deepEqual(inferMockExam(file,'',{year:2024},cover),result);
assert.equal(inferMockExam(file,'',{year:2026},cover),undefined);

const native=mockExamCoverHeader('2025年上海闵行区初三数学二模试卷。 第1题 示例题干');
assert.equal(inferMockExam('扫描件.pdf','',{year:2025},native).metadata.district,'闵行区');
const mismatch=inferMockExam('2025上海嘉定区初三数学二模试卷.pdf','',{year:2025},native);
assert.deepEqual(mismatch.conflicts,['district']);

const term=mockExamCoverHeader('杨浦区2024—2025学年度高三数学模拟质量调研\n数学 2025年3月\n2. 2028年的题目');
const termResult=inferMockExam('扫描.pdf','',{year:2024},term);
assert.deepEqual(termResult.cover,{page:1,academicYear:2024,academicEndYear:2025,examMonth:{year:2025,month:3}});
assert.deepEqual(termResult.conflicts,['year']);
assert.equal(mockExamCoverHeader('1. 上海2025年模拟的题干'), '');
assert.equal(inferMockExam(file,'',{year:2025}).metadata.year,2025);
const spring=mockExamCoverHeader('2025学年第二学期九年级综合练习\n(2026.05)\n物理部分\n(物理、化学、跨学科共120分钟)\n1. 徐汇模拟题正文');
const springFile='2026奉贤三模(3).pdf';
const springScope={year:2026,subject:'物理',grade:'九年级',districts:['奉贤区'],rounds:['三模']};
const springResult=inferMockExam(springFile,'',springScope,spring);
assert.deepEqual(springResult.metadata,{district:'奉贤区',year:2026,subject:'物理',grade:'九年级',round:'三模'});
assert.deepEqual(springResult.cover,{page:1,academicYear:2025,examMonth:{year:2026,month:5}});
assert.equal(inferMockExam(springFile,'',{...springScope,year:2025},spring),undefined);
assert.equal(inferMockExam('26年6月风华初三三模模拟测试卷.pdf','',springScope,spring),undefined);
assert.equal(inferMockExam('2026奉贤课堂练习.pdf','',springScope,spring),undefined);
assert.deepEqual(inferMockExam('2026奉贤三模化学试卷.pdf','',{year:2026},spring).conflicts,['subject']);
const wrongSeason=spring.replace('2026.05','2026.10');
assert.deepEqual(inferMockExam(springFile,'',springScope,wrongSeason).conflicts,['year']);
console.log(JSON.stringify({ok:true,checks:15}));
