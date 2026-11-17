import {AI_ISSUES, normalizeAiMissingRoleMarkers} from './material-ai';
import {parseNativeAiResponse} from './material-ai-native-response';
import {isNativeFieldReview, parseNativeAiReview, nativeReviewSchema, NATIVE_FIELD_REVIEW, NATIVE_FIELD_REVIEW_V3, type NativeFieldReviewPolicy} from './material-ai-native-review';
import {aiTextSignature} from './material-ai-image';

export const AI_RESPONSE_RECOVERY = 'native-response-recovery.v1' as const;
export const AI_ANSWER_CONFLICT_RECOVERY = 'native-response-recovery.v2' as const;
export const AI_UNCERTAIN_REVIEW_RECOVERY = 'native-response-recovery.v3' as const;
export type AiResponseRecovery = {raw: string; changes: string[]; policy?:typeof AI_ANSWER_CONFLICT_RECOVERY | typeof AI_UNCERTAIN_REVIEW_RECOVERY};

/** Keeps historical parsers strict and records each bounded representation repair separately. */
export function recoverNativeResponse(raw: string, firstRaw: string, firstSha: string,
    policy?: NativeFieldReviewPolicy): AiResponseRecovery {
    if (new TextEncoder().encode(raw).byteLength > 128 * 1024) throw Error('invalid_response');
    const value = JSON.parse(raw);
    if (!firstRaw) {
        if (value?.outcome === 'no_questions' && Array.isArray(value.questions) && value.questions.length)
            throw Error('response_outcome_conflict');
        if (value?.questions?.some((question: {difficulty?: unknown}) => question.difficulty === ''))
            throw Error('response_difficulty_missing');
        parseNativeAiResponse(normalizeAiMissingRoleMarkers(raw));
        throw Error('response_second_pass_missing');
    }
    const first = parseNativeAiResponse(firstRaw);
    if (!isNativeFieldReview(policy) || first.questions.length !== 1) {
        parseNativeAiResponse(raw);
        return {raw, changes: []};
    }
    try {
        parseNativeAiReview(raw, first, firstSha, policy);
        return {raw, changes: []};
    } catch {
        // Only a source-bound review with an explicitly uncertain conclusion can be repaired.
    }
    if (!value || !['needs_review', 'corrected'].includes(value.decision) ||
        !value.checks || typeof value.checks !== 'object' || Array.isArray(value.checks))
        throw Error('invalid_response');
    const changes: string[] = [];
    const question = {...first.questions[0], ...(value.corrected || {})};
    for (const role of ['answer', 'analysis'] as const) {
        if (question[role + 'Origin' as 'answerOrigin'] === 'missing' && question[role] === '' &&
            value.checks[role] === 'uncertain') {
            value.checks[role] = 'not_applicable';
            changes.push(role + '-missing-check');
        }
    }
    if (!Object.hasOwn(value, 'issues') && value.decision === 'corrected' &&
        Array.isArray(value.corrected?.issues) && value.corrected.issues.length &&
        value.corrected.issues.every((issue: unknown) => AI_ISSUES.includes(issue as typeof AI_ISSUES[number])) &&
        Object.values(value.checks).includes('uncertain')) {
        value.issues = [...value.corrected.issues];
        changes.push('review-issues-from-correction');
    }
    // An explicit uncertain answer and a different bound candidate are evidence for holding both drafts.
    // The strict reader still authenticates the complete merged question and every source binding.
    const answerConflict = value.decision === 'corrected' &&
        (value.checks.answer === 'uncertain' || value.checks.analysis === 'uncertain') &&
        Array.isArray(value.issues) && !value.issues.length &&
        Array.isArray(question.issues) && !question.issues.length &&
        typeof question.answer === 'string' && !!question.answer.trim() &&
        !!first.questions[0].answer.trim() &&
        aiTextSignature(question.answer) !== aiTextSignature(first.questions[0].answer);
    if (answerConflict) {
        value.issues = ['answer_conflict'];
        changes.push('uncertain-changed-answer-conflict');
    }
    let readerPolicy = policy;
    let recoveryPolicy: AiResponseRecovery['policy'] = answerConflict ? AI_ANSWER_CONFLICT_RECOVERY : undefined;
    if (!answerConflict && policy === NATIVE_FIELD_REVIEW && value.schemaVersion === nativeReviewSchema(policy) &&
        Object.values(value.checks).includes('uncertain') && Array.isArray(value.issues) && !value.issues.length &&
        Array.isArray(question.issues) && !question.issues.length) {
        readerPolicy = NATIVE_FIELD_REVIEW_V3;
        value.schemaVersion = nativeReviewSchema(readerPolicy);
        recoveryPolicy = AI_UNCERTAIN_REVIEW_RECOVERY;
        changes.push('explicit-uncertain-review-v3');
    }
    const repaired = JSON.stringify(value);
    const result = parseNativeAiReview(repaired, first, firstSha, readerPolicy);
    if (!changes.length || result.response.outcome !== 'needs_review') throw Error('invalid_response');
    return {raw: repaired, changes, ...(recoveryPolicy ? {policy:recoveryPolicy} : {})};
}
