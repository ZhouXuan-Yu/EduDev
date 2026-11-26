export const HEALTH_WINDOW_MS = 60 * 60 * 1000;
export const HEALTH_SAMPLE_LIMIT = 64;
export const MIN_RELIABLE_SAMPLES = 5;
const ALPHA = 0.25;

export type RuntimeSample = {at: number; latencyMs: number; ok: boolean; source?:'call'|'probe'};
export type QualitySample = {at: number; passed: boolean; evidence: string};

export function wilsonLower(passed: number, count: number) {
    if (!count) return null;
    const z = 1.96;
    const rate = passed / count;
    return Math.max(0, (rate + z ** 2 / (2 * count) - z * Math.sqrt((rate * (1 - rate) + z ** 2 / (4 * count)) / count)) / (1 + z ** 2 / count));
}

export function profile(samples: readonly RuntimeSample[], quality: readonly QualitySample[], now: number) {
    const window = samples.filter(sample => sample.at <= now && sample.at > now - HEALTH_WINDOW_MS);
    const recent = window.filter(sample=>sample.source!=='probe');
    const recentQuality = quality.filter(sample => sample.at <= now && sample.at > now - HEALTH_WINDOW_MS);
    const success = recent.filter(sample => sample.ok);
    const sorted = success.map(sample => sample.latencyMs).sort((a,b) => a - b);
    const smooth = success.reduce<number | null>((average, sample) =>
        average === null ? sample.latencyMs : ALPHA * sample.latencyMs + (1 - ALPHA) * average, null);
    return {
        count: recent.length, success: success.length, lastAt: recent.at(-1)?.at ?? null,
        probeCount: window.length-recent.length,
        ewmaLatencyMs: smooth, p95LatencyMs: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null,
        reliability: wilsonLower(success.length, recent.length), qualityCount: recentQuality.length,
        quality: wilsonLower(recentQuality.filter(sample => sample.passed).length, recentQuality.length),
        qualityEvidence: recentQuality.slice(-5).map(sample => sample.evidence),
        trusted: recent.length >= MIN_RELIABLE_SAMPLES && success.length > 0,
    };
}

export type EvidenceProfile = ReturnType<typeof profile>;
type Point = {latency: number; reliability: number; quality: number | null};
function dominates(left: Point, right: Point) {
    if ((left.quality === null) !== (right.quality === null)) return false;
    const qualityDelta = (left.quality ?? 0) - (right.quality ?? 0);
    return left.latency <= right.latency && left.reliability >= right.reliability && qualityDelta >= 0
        && (left.latency < right.latency || left.reliability > right.reliability || qualityDelta > 0);
}
export function pareto<T>(items: readonly T[], point: (item: T) => Point) {
    return items.filter(item => !items.some(other => item !== other && dominates(point(other), point(item))));
}
