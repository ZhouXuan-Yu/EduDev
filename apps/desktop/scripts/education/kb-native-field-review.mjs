import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const { parseNativeAiResponse } = await import('../../src/shared/material-ai-native-response.ts');
const { NATIVE_REVIEW_RESPONSE, NATIVE_REVIEW_CHECKS, parseNativeAiReview } = await import('../../src/shared/material-ai-native-review.ts');
const hash = value => createHash('sha256').update(value).digest('hex');
const question = { number: '1', stem: '如图，物体向上加速，判断支持力与重力的关系。', answer: '大于', analysis: '合力向上，支持力大于重力。', subject: '物理', grade: '高三', knowledgePoint: '牛顿第二定律', questionType: '选择题', difficulty: 'easy', answerOrigin: 'ai_generated', analysisOrigin: 'ai_generated', requiresImage: false, issues: [], projection: { statement: { state: 'provided', text: '如图，物体向上加速，判断支持力与重力的关系。' }, formulas: { state: 'not_applicable', text: '' }, tables: { state: 'not_applicable', text: '' }, figures: { state: 'provided', text: '物体受到竖直向上的支持力和竖直向下的重力。' }, choices: { state: 'not_applicable', text: '' }, subquestions: { state: 'not_applicable', text: '' } } };
const first = parseNativeAiResponse(JSON.stringify({ schemaVersion: 'xiaozhi.material-ai-native-response.v1', outcome: 'questions', questions: [question] }));
const digest = hash(JSON.stringify(first)), checks = [];
function review(value = first) { return { schemaVersion: NATIVE_REVIEW_RESPONSE, firstSha256: digest, number: value.questions[0].number, decision: 'verified', checks: Object.fromEntries(NATIVE_REVIEW_CHECKS.map(k => [k, k in value.questions[0].projection && value.questions[0].projection[k].state === 'not_applicable' ? 'not_applicable' : 'verified'])), corrected: null, issues: [] }; }
function check(name, run) { run(); checks.push(name); console.log('PASS ' + name); }
const parse = value => parseNativeAiReview(JSON.stringify(value), first, digest);
check('Verified review preserves every first-pass field and its exact explanation without generating replacement text', () => {
    const before = JSON.stringify(first), result = parse(review());
    assert.deepEqual(result.response, first);
    assert.equal(result.response.questions[0].analysis, question.analysis);
    assert.equal(JSON.stringify(first), before);
    result.response.questions[0].analysis = 'changed';
    assert.equal(first.questions[0].analysis, question.analysis);
});
check('Explicit corrections retain a full independently checked draft and the original explanation for comparison', () => {
    const v = review();
    v.decision = 'corrected';
    v.corrected = {analysis:'合力向下，支持力小于重力。',answer:'小于'};
    const r = parse(v);
    assert.equal(r.response.questions[0].answer, '小于');
    assert.equal(first.questions[0].answer, '大于');
});
check('Uncertain review preserves the original draft and produces an explicit incomplete outcome', () => {
    const v = review();
    v.decision = 'needs_review';
    v.checks.figures = 'uncertain';
    v.issues = ['uncertain_ocr'];
    const r = parse(v);
    assert.equal(r.response.outcome, 'needs_review');
    assert.deepEqual(r.response.questions[0].issues, ['uncertain_ocr']);
    assert.equal(r.response.questions[0].analysis, question.analysis);
});
for (const [name, mutate] of [
    ['Wrong source draft digest', v => { v.firstSha256 = 'f'.repeat(64); }],
    ['Wrong printed number', v => { v.number = '2'; }],
    ['Unknown response version', v => { v.schemaVersion = 'future'; }],
    ['Additional root explanation', v => { v.analysis = 'stylistic rewrite'; }],
    ['Missing figure check', v => { delete v.checks.figures; }],
    ['Additional check', v => { v.checks.extra = 'verified'; }],
    ['Invalid check state', v => { v.checks.analysis = true; }],
    ['Existing figure called not applicable', v => { v.checks.figures = 'not_applicable'; }],
    ['Absent formulas called verified', v => { v.checks.formulas = 'verified'; }],
    ['Uncertain review called verified', v => { v.checks.analysis = 'uncertain'; }],
    ['Undocumented uncertain result', v => { v.decision = 'needs_review'; v.checks.answer = 'uncertain'; }],
    ['Unsupported issues', v => { v.decision = 'needs_review'; v.issues = ['teacher_confirmed']; }],
    ['Duplicate issues', v => { v.decision = 'needs_review'; v.checks.analysis = 'uncertain'; v.issues = ['uncertain_ocr', 'uncertain_ocr']; }],
    ['Verified draft carries a replacement', v => { v.corrected = structuredClone(first); }],
    ['Corrected decision missing a draft', v => { v.decision = 'corrected'; }],
    ['Corrected replacement changes selected number', v => { v.decision = 'corrected'; v.corrected = structuredClone(first); v.corrected={number:'9'}; }],
    ['Corrected replacement includes multiple questions', v => { v.decision = 'corrected'; v.corrected = structuredClone(first); v.corrected.questions.push(structuredClone(question)); }],
    ['Corrected replacement invents a field', v => { v.decision = 'corrected'; v.corrected = structuredClone(first); v.corrected.questions[0].confidence = 1; }],
])
    check(name + ' is rejected', () => { const value = review(); mutate(value); assert.throws(() => parse(value), /invalid_response/); });
check('A metadata-only patch keeps all physical statements, answers, explanations and images byte-identical',()=>{
 const value=review();value.decision='corrected';value.corrected={grade:'高中'};
 const target=parse(value).response.questions[0];assert.equal(target.grade,'高中');assert.deepEqual({...target,grade:question.grade},question);
});
check('Missing projection content cannot be certified as verified', () => {
    const bad = structuredClone(first);
    bad.questions[0].projection.figures = { state: 'missing', text: '' };
    const value = review(bad);
    assert.throws(() => parseNativeAiReview(JSON.stringify(value), bad, digest), /invalid_response/);
});
check('Oversized, malformed and unbound empty-question responses are rejected', () => {
    assert.throws(() => parseNativeAiReview('x'.repeat(128 * 1024 + 1), first, digest), /invalid_response/);
    assert.throws(() => parseNativeAiReview('{', first, digest), /invalid_response/);
    assert.throws(() => parseNativeAiReview(JSON.stringify(review()), { ...first, questions: [] }, digest), /invalid_response/);
});
const { validAiNativeSelector } = await import('../../src/shared/material-ai-native-input.ts');
const selector = { schemaVersion: 'xiaozhi.material-ai-native-input.v1', base: { schemaVersion: 'xiaozhi.word-question-proof.v1', resourceId: 'resource_11111111-1111-4111-8111-111111111111', version: 'a'.repeat(64), documentSha: 'b'.repeat(64), ordinal: 1 }, sourceDigest: 'c'.repeat(64) };
check('Legacy selector stays valid and the exact new review policy is frozen in the private selector', () => {
    assert(validAiNativeSelector(selector));
    assert(validAiNativeSelector({ ...selector, reviewPolicy: 'native-field-review.v1' }));assert(validAiNativeSelector({ ...selector, reviewPolicy: 'native-field-review.v2' }));
});
check('Unknown, empty and undefined review policies fail selector validation', () => {
    for (const reviewPolicy of ['future', '', undefined])
        assert(!validAiNativeSelector({ ...selector, reviewPolicy }));
});
if (process.argv[2])
    check('The saved real wording-only pair retains legacy difference while the new verified protocol selects the frozen first draft', () => {
        const pair = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), a = parseNativeAiResponse(JSON.stringify(pair.first)), b = parseNativeAiResponse(JSON.stringify(pair.final));
        assert.equal(a.questions[0].answer, b.questions[0].answer);
        assert.notEqual(a.questions[0].analysis, b.questions[0].analysis);
        assert.deepEqual({ ...a.questions[0], analysis: '' }, { ...b.questions[0], analysis: '' });
        const sha = hash(JSON.stringify(a)), value = { ...review(a), firstSha256: sha };
        const restored = parseNativeAiReview(JSON.stringify(value), a, sha);
        assert.deepEqual(restored.response, a);
    });


if(process.argv[3])check('The first real v1 review retains its classification and image uncertainty under the frozen v1 reader',()=>{
 const pair=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),sha=pair.questions[0].archive.ai.firstSha;
 assert.equal(pair.final.firstSha256,sha);const result=parseNativeAiReview(JSON.stringify(pair.final),pair.first,sha,'native-field-review.v1');
 assert.equal(result.response.outcome,'needs_review');assert(result.response.questions[0].issues.includes('requires_image'));assert.equal(result.response.questions[0].analysis,pair.first.questions[0].analysis);
});
check('Policy and response versions cannot be exchanged across frozen review inputs',()=>{
 const current=review();const old={...current,schemaVersion:'xiaozhi.material-ai-native-review.v1',checks:{...current.checks,classification:'verified'}};
 assert.throws(()=>parseNativeAiReview(JSON.stringify(old),first,digest),/invalid_response/);
 assert.throws(()=>parseNativeAiReview(JSON.stringify(current),first,digest,'native-field-review.v1'),/invalid_response/);
 assert.throws(()=>parseNativeAiReview(JSON.stringify(current),first,digest,'future'),/invalid_response/);
});
console.log(JSON.stringify({ passed: checks.length, checks, scope: 'Strict field-review protocol and immutable derivation. A constructed review is controlled evidence, not a real model judgment.' }));
